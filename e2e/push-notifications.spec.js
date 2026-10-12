import { createServer } from "node:http";
import { test, expect } from "@playwright/test";

// A real HTTP proxy injects origin faults: browser routing does not intercept all
// service-worker installation requests. The production assets and lifecycle stay real.
let server;
let origin;
let fault = "";
let failures = [];
test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    const path = request.url.split("?")[0];
    if (fault === "redirect" && path === "/service-worker.js") {
      failures.push(path);
      response.writeHead(302, { Location: "/access-login" }); response.end(); return;
    }
    if (path === "/access-login") {
      response.writeHead(200, { "Content-Type": "text/html" }); response.end("Access login required"); return;
    }
    if (fault === "precache" && path === "/icon-512.png") {
      failures.push(path);
      response.writeHead(503); response.end("Unavailable"); return;
    }
    try {
      const upstream = await fetch(`http://127.0.0.1:4173${request.url}`);
      if (!upstream.ok) failures.push(path);
      const headers = Object.fromEntries(upstream.headers);
      delete headers["content-encoding"]; delete headers["content-length"];
      response.writeHead(upstream.status, headers);
      response.end(Buffer.from(await upstream.arrayBuffer()));
    } catch { response.writeHead(502); response.end(); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); });
test.beforeEach(() => { fault = ""; failures = []; });

async function fixtures(context, permission = "granted") {
  const state = { saved: 0, offline: false };
  await context.addInitScript(({ permission }) => {
    const payload = btoa(JSON.stringify({ sub: "user-1", exp: Math.floor(Date.now() / 1000) + 3600 }));
    localStorage.setItem("endgame_grocery.auth_token", `e30.${payload}.signature`);
    localStorage.setItem("endgame_grocery.auth_user", JSON.stringify({ id: "user-1", display_name: "Demo User" }));
    localStorage.setItem("i18nextLng", "en");
    // Subscription transport only is deterministic. Registration, installation,
    // activation, ready and offline navigation are the browser's actual APIs.
    window.pushCalls = 0; window.permissionCalls = 0;
    Object.defineProperty(Notification, "permission", { configurable: true, get: () => permission });
    Notification.requestPermission = async () => { window.permissionCalls++; return permission; };
    let subscription = null;
    PushManager.prototype.getSubscription = async () => subscription;
    PushManager.prototype.subscribe = async () => {
      window.pushCalls++;
      await new Promise(resolve => setTimeout(resolve, 200));
      subscription = { endpoint: "https://fcm.googleapis.com/test", toJSON: () => ({ endpoint: "https://fcm.googleapis.com/test", keys: { auth: "test", p256dh: "test" } }), unsubscribe: async () => { subscription = null; return true; } };
      return subscription;
    };
  }, { permission });
  await context.route("**/api/**", async route => {
    if (state.offline) { await route.abort("internetdisconnected"); return; }
    const path = new URL(route.request().url()).pathname;
    let body = {};
    if (path === "/api/config") body = { registrationEnabled: true };
    else if (path === "/api/auth/me") body = { user: { id: "user-1", display_name: "Demo User" } };
    else if (path === "/api/push/vapid-public-key") body = { publicKey: "dGVzdA" };
    else if (path === "/api/push/subscribe") { state.saved++; }
    else if (path.endsWith("/entries")) body = { entries: [{ id: "entry-1", list_id: "list-1", text: "Milk", status: "open", created_by: "user-1", created_at: "2026-10-12T00:00:00Z" }] };
    else if (path.endsWith("/history")) body = { history: [] };
    else if (path.endsWith("/members")) body = { members: [] };
    else if (path === "/api/lists/list-1") body = { list: { id: "list-1", name: "Shared groceries", owner_name: "Alex", is_owner: false } };
    else if (path === "/api/events/ticket") body = { ticket: "test" };
    else if (path === "/api/events") { await route.fulfill({ contentType: "text/event-stream", body: ": connected\n\n" }); return; }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  });
  return state;
}
async function activeWorker(page) {
  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration?.active?.state;
  })).toBe("activated");
}

test("production worker activates, opt-in saves once, and cached shell/list work offline (stubbed push transport)", async ({ page, context }) => {
  const state = await fixtures(context);
  await page.goto(`${origin}/lists/list-1`);
  await activeWorker(page);
  expect(failures).toEqual([]);
  await expect(page.getByText("Milk", { exact: true })).toBeVisible();
  const button = page.getByRole("button", { name: "Enable notifications" });
  await expect(button).toBeEnabled();
  await button.evaluate(element => { element.click(); element.click(); });
  await expect(page.getByRole("button", { name: "Disable notifications" })).toBeVisible();
  expect(state.saved).toBe(1);
  expect(await page.evaluate(() => window.pushCalls)).toBe(1);
  state.offline = true;
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Shared groceries", { exact: true })).toBeVisible();
  await expect(page.getByText("Milk", { exact: true })).toBeVisible();
});

for (const kind of ["redirect", "precache"]) {
  test(`recovers from ${kind} failure on the same page (real worker, stubbed push transport)`, async ({ page, context }) => {
    const state = await fixtures(context);
    fault = kind;
    await page.goto(`${origin}/lists/list-1`);
    await expect(page.getByRole("alert")).toContainText(kind === "redirect" ? "could not register" : "could not finish installing");
    expect(failures.length).toBeGreaterThan(0);
    const pageSession = await page.evaluate(() => { window.sessionMarker = "same-page"; return performance.timeOrigin; });
    await page.getByRole("button", { name: "Enable notifications" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    expect(state.saved).toBe(0);
    fault = "";
    await page.getByRole("button", { name: "Enable notifications" }).click();
    await expect(page.getByRole("button", { name: "Disable notifications" })).toBeVisible();
    await activeWorker(page);
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(pageSession);
    expect(await page.evaluate(() => window.sessionMarker)).toBe("same-page");
    expect(state.saved).toBe(1);
  });
}

test("denied permission gives settings feedback without prompting (stubbed permission)", async ({ page, context }) => {
  const state = await fixtures(context, "denied");
  await page.goto(`${origin}/lists/list-1`);
  await activeWorker(page);
  await page.getByRole("button", { name: "Enable notifications" }).click();
  await expect(page.getByRole("alert")).toContainText("browser or device settings");
  await page.getByRole("button", { name: "Enable notifications" }).click();
  expect(await page.evaluate(() => window.permissionCalls)).toBe(0);
  expect(state.saved).toBe(0);
});
