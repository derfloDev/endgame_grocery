import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { precache, addRoute, createHandlerBoundToURL } from "workbox-precaching";

vi.mock("workbox-core", () => ({ clientsClaim: vi.fn() }));
vi.mock("workbox-routing", () => ({ NavigationRoute: vi.fn(), registerRoute: vi.fn() }));
vi.mock("workbox-precaching", () => ({ createHandlerBoundToURL: vi.fn(() => vi.fn()), precache: vi.fn(), addRoute: vi.fn() }));

let handlers;
let worker;

beforeEach(async () => {
  vi.resetModules();
  handlers = {};
  worker = {
    skipWaiting: vi.fn(),
    addEventListener: vi.fn((type, handler) => { handlers[type] = handler; }),
    location: { origin: "https://grocery.example" },
    registration: { showNotification: vi.fn().mockResolvedValue(undefined) },
    clients: {
      matchAll: vi.fn().mockResolvedValue([]),
      openWindow: vi.fn().mockResolvedValue({})
    }
  };
  vi.stubGlobal("self", worker);
  await import("./service-worker.js");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function dispatch(type, fields) {
  const waitUntil = vi.fn();
  handlers[type]({ ...fields, waitUntil });
  expect(waitUntil).toHaveBeenCalledTimes(1);
  await waitUntil.mock.calls[0][0];
}

describe("service worker push notifications", () => {
  it("registers navigations before the precache directory-index route", () => {
    // Vite's development PWA transform supplies an empty manifest during Vitest.
    expect(precache).toHaveBeenCalledWith([]);
    expect(NavigationRoute).toHaveBeenCalledWith(expect.any(Function));
    expect(registerRoute).toHaveBeenCalledWith(NavigationRoute.mock.instances[0]);
    expect(precache.mock.invocationCallOrder[0]).toBeLessThan(registerRoute.mock.invocationCallOrder[0]);
    expect(registerRoute.mock.invocationCallOrder[0]).toBeLessThan(addRoute.mock.invocationCallOrder[0]);
  });

  it("defers the shell lookup until fallback so missing dev precache does not break evaluation", async () => {
    expect(createHandlerBoundToURL).not.toHaveBeenCalled();
    const fallback = vi.fn().mockResolvedValue(new Response("shell"));
    createHandlerBoundToURL.mockReturnValueOnce(fallback);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const options = { request: {}, url: new URL("https://grocery.example/") };
    await NavigationRoute.mock.calls[0][0](options);
    expect(createHandlerBoundToURL).toHaveBeenCalledWith("/index.html");
    expect(fallback).toHaveBeenCalledWith(options);
  });

  it("shows the default notification when push has no data", async () => {
    await dispatch("push", { data: null });
    expect(worker.registration.showNotification).toHaveBeenCalledWith("Endgame Grocery", {
      body: "A shared list has new activity.",
      icon: "/icon-192.png", badge: "/icon-192.png", data: { listId: "" }
    });
  });

  it("preserves the supplied title, body and target list", async () => {
    await dispatch("push", { data: { json: () => ({ title: "Pantry", body: "Milk added", listId: "list-7" }) } });
    expect(worker.registration.showNotification).toHaveBeenCalledWith("Pantry", {
      body: "Milk added", icon: "/icon-192.png", badge: "/icon-192.png", data: { listId: "list-7" }
    });
  });

  it("closes the notification, navigates and focuses an existing window", async () => {
    const client = { navigate: vi.fn().mockResolvedValue({}), focus: vi.fn().mockResolvedValue({}) };
    const otherClient = { navigate: vi.fn(), focus: vi.fn() };
    worker.clients.matchAll.mockResolvedValue([client, otherClient]);
    const close = vi.fn();

    await dispatch("notificationclick", { notification: { close, data: { listId: "list-7" } } });

    expect(close).toHaveBeenCalledTimes(1);
    expect(worker.clients.matchAll).toHaveBeenCalledWith({ type: "window", includeUncontrolled: true });
    expect(client.navigate).toHaveBeenCalledWith("https://grocery.example/lists/list-7");
    expect(client.focus).toHaveBeenCalledTimes(1);
    expect(otherClient.focus).not.toHaveBeenCalled();
    expect(worker.clients.openWindow).not.toHaveBeenCalled();
  });

  it.each([
    [{ listId: "list-7" }, "https://grocery.example/lists/list-7"],
    [undefined, "https://grocery.example/"]
  ])("opens a new window for notification data %j when no window exists", async (data, url) => {
    const close = vi.fn();
    await dispatch("notificationclick", { notification: { close, data } });
    expect(close).toHaveBeenCalledTimes(1);
    expect(worker.clients.openWindow).toHaveBeenCalledWith(url);
  });
});
