import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("workbox-core", () => ({ clientsClaim: vi.fn() }));
vi.mock("workbox-routing", () => ({ NavigationRoute: vi.fn(), registerRoute: vi.fn() }));
vi.mock("workbox-precaching", () => ({ createHandlerBoundToURL: vi.fn(), precacheAndRoute: vi.fn() }));

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
