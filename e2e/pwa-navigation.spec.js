import { createServer } from "node:http";
import { test, expect } from "@playwright/test";

// Inject navigation faults over HTTP so the real production worker owns fetches.
let server, origin;
let fault = "";
let navigationRequests = [];

test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    const path = new URL(request.url, "http://proxy").pathname;
    const navigation = request.headers["sec-fetch-mode"] === "navigate";
    if (navigation) navigationRequests.push(path);
    // Chromium's worker fetches can outlive the page's emulated offline transition.
    // Also reject at the origin so every navigation fetch has a real network failure.
    if (navigation && fault === "offline") { response.destroy(); return; }
    if (navigation && path === "/access-login") {
      response.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" });
      response.end("<h1>Access login required</h1>"); return;
    }
    if (navigation && fault === "redirect") {
      response.writeHead(302, { Location: "/access-login", "Cache-Control": "no-store" });
      response.end(); return;
    }
    if (navigation && fault === "outage") {
      response.writeHead(503, { "Cache-Control": "no-store" });
      response.end("Origin unavailable"); return;
    }
    if (navigation && fault === "delay") {
      await new Promise(resolve => setTimeout(resolve, 4500));
      response.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" });
      response.end("<h1>Delayed network response</h1>"); return;
    }
    try {
      const upstream = await fetch(`http://127.0.0.1:4173${request.url}`);
      const headers = Object.fromEntries(upstream.headers);
      delete headers["content-encoding"]; delete headers["content-length"];
      response.writeHead(upstream.status, headers);
      response.end(Buffer.from(await upstream.arrayBuffer()));
    } catch { response.writeHead(502); response.end(); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
  await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
});
test.beforeEach(async ({ context }) => {
  fault = ""; navigationRequests = [];
  await context.addInitScript(() => {
    const payload = btoa(JSON.stringify({ sub: "user-1", exp: Math.floor(Date.now() / 1000) + 3600 }));
    localStorage.setItem("endgame_grocery.auth_token", `e30.${payload}.signature`);
    localStorage.setItem("endgame_grocery.auth_user", JSON.stringify({ id: "user-1", display_name: "Demo User" }));
    localStorage.setItem("i18nextLng", "en");
  });
  await context.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const list = { id: "list-1", name: "Shared groceries", owner_name: "Alex", is_owner: false };
    let body = {};
    if (path === "/api/config") body = { registrationEnabled: true };
    else if (path === "/api/auth/me") body = { user: { id: "user-1", display_name: "Demo User" } };
    else if (path === "/api/lists") body = { lists: [list] };
    else if (path === "/api/lists/list-1") body = { list };
    else if (path.endsWith("/entries")) body = { entries: [] };
    else if (path.endsWith("/history")) body = { history: [] };
    else if (path.endsWith("/members")) body = { members: [] };
    else if (path === "/api/events/ticket") body = { ticket: "test" };
    else if (path === "/api/events") {
      await route.fulfill({ contentType: "text/event-stream", body: ": connected\n\n" }); return;
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  });
});

async function install(page, path) {
  await page.goto(`${origin}${path}`);
  await expect(page.getByText("Shared groceries", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  navigationRequests = [];
}

for (const path of ["/", "/lists/list-1"]) {
  test(`reload of ${path} reaches Access and preserves the offline shell`, async ({ page, context }) => {
    await install(page, path);
    fault = "redirect";
    await page.reload();
    await expect(page.getByRole("heading", { name: "Access login required" })).toBeVisible();
    expect(navigationRequests).toContain(path);
    expect(navigationRequests).toContain("/access-login");
    fault = "offline";
    await context.setOffline(true);
    await page.reload();
    // The login URL also falls back to the app shell, rather than cached login HTML.
    await expect(page.locator("#root > *").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Access login required" })).toHaveCount(0);
    await page.goto(`${origin}${path}`);
    await expect(page.getByText("Shared groceries", { exact: true })).toBeVisible();
  });
}

test("origin 503 keeps the offline-capable shell", async ({ page }) => {
  await install(page, "/lists/list-1");
  fault = "outage";
  await page.reload();
  await expect(page.getByText("Shared groceries", { exact: true })).toBeVisible();
  expect(navigationRequests).toContain("/lists/list-1");
  await expect(page.getByText("Origin unavailable")).toHaveCount(0);
});

test("slow navigation falls back at three seconds; reconnect waits for the network", async ({ page }) => {
  await install(page, "/lists/list-1");
  fault = "delay";
  const start = Date.now();
  await page.reload({ waitUntil: "domcontentloaded" });
  expect(Date.now() - start).toBeGreaterThanOrEqual(2900);
  await expect(page.getByText("Shared groceries", { exact: true })).toBeVisible();
  // Wait beyond the late response: it must not replace the fallback document.
  await page.waitForTimeout(1700);
  await expect(page.getByRole("heading", { name: "Delayed network response" })).toHaveCount(0);
  await page.goto(`${origin}/lists/list-1?__reconnect=1`);
  await expect(page.getByRole("heading", { name: "Delayed network response" })).toBeVisible();
});
