import { expect, test } from "@playwright/test";

// Keep the dev transport controlled while exercising the real request/queue/UI integration.
test.use({ serviceWorkers: "block" });

async function setup(page) {
  await page.addInitScript(() => {
    localStorage.setItem("endgame_grocery.auth_token", "e30.eyJzdWIiOiJ1c2VyLTEifQ.test");
    localStorage.setItem("endgame_grocery.auth_user", JSON.stringify({ id: "user-1", display_name: "Tester" }));
    localStorage.setItem("i18nextLng", "en");
    // No open stream can hide a gated request by reporting fresh online evidence.
    window.EventSource = class extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSED = 2;
      readyState = 0;
      close() { this.readyState = 2; }
    };
  });
  const state = { gate: "", offline: false, writes: [], entries: [] };
  await page.route((url) => url.pathname.startsWith("/api/"), async route => {
    if (state.offline) return route.abort("internetdisconnected");
    if (state.gate === "redirect") return route.fulfill({ status: 302, headers: { Location: "https://access.example.com/login" }, body: "" });
    if (state.gate === "challenge") return route.fulfill({ status: 403, contentType: "text/html", headers: { "cf-mitigated": "challenge" }, body: "Complete the challenge" });
    const path = new URL(route.request().url()).pathname;
    const list = { id: "list-1", name: "Weekly groceries", is_owner: true };
    if (route.request().method() === "POST" && path === "/api/lists/list-1/entries") {
      const payload = route.request().postDataJSON();
      state.writes.push(payload.text);
      const entry = { ...payload, id: `entry-${state.writes.length}`, status: "open", list_id: "list-1" };
      state.entries.push(entry);
      return route.fulfill({ json: { entry } });
    }
    let body = {};
    if (path === "/api/config") body = { registrationEnabled: true };
    else if (path === "/api/events/ticket") body = { ticket: "e2e-ticket" };
    else if (path === "/api/lists") body = { lists: [list] };
    else if (path === "/api/lists/list-1") body = { list };
    else if (path.endsWith("/entries")) body = { entries: state.entries };
    else if (path.endsWith("/history")) body = { history: [] };
    else if (path.endsWith("/members")) body = { members: [] };
    else if (path.endsWith("/suggestions")) body = { suggestions: [] };
    return route.fulfill({ json: body });
  });
  await page.goto("/lists/list-1?filter=open#items");
  await expect(page.getByText("Weekly groceries", { exact: true })).toBeVisible();
  return state;
}

async function addItem(page, text) {
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Add Item", exact: true });
  await sheet.getByRole("textbox", { name: "Add item", exact: true }).fill(text);
  await sheet.getByRole("button", { name: "Add Item", exact: true }).click();
  await expect(page.getByText(text, { exact: true })).toBeVisible();
  // The sheet covers the backdrop's center; click its exposed top-left corner.
  await page.getByRole("button", { name: "Close sheet", exact: true }).click({ position: { x: 10, y: 10 } });
  await expect(sheet).toHaveCount(0);
}

for (const gate of ["redirect", "challenge"]) {
  test(`${gate} keeps cached reads and queued writes, then reconnect drains each change once`, async ({ page }) => {
    const state = await setup(page);
    state.gate = gate;
    await page.reload();
    const reconnect = page.getByRole("button", { name: "Reconnect", exact: true });
    await expect(reconnect).toBeVisible();
    await expect(page.getByText("Weekly groceries", { exact: true })).toBeVisible();
    await expect(page.getByText(/Offline mode:/)).toHaveCount(0);
    await addItem(page, "Gate milk");
    await addItem(page, "Gate bread");
    await expect(page.getByText("Connected, but your access session has expired. 2 changes will sync after you reconnect.", { exact: true })).toBeVisible();
    expect(state.writes).toEqual([]);
    const reconnectRequests = [];
    page.on("request", request => { if (request.isNavigationRequest()) reconnectRequests.push(request.url()); });
    state.gate = "";
    await reconnect.click();
    await expect.poll(() => state.writes).toEqual(["Gate milk", "Gate bread"]);
    await expect(reconnect).toHaveCount(0);
    await expect.poll(() => page.evaluate(async () => (await (await import("/src/api/offlineStore.ts")).listOfflineMutations()).length)).toBe(0);
    expect(reconnectRequests.some(url => new URL(url).searchParams.has("__reconnect"))).toBe(true);
    const url = new URL(page.url());
    expect(url.searchParams.has("__reconnect")).toBe(false);
    expect(url.searchParams.get("filter")).toBe("open");
    expect(url.hash).toBe("#items");
    // Recovery/wake signals cannot send already accepted mutations again.
    await page.evaluate(() => { window.dispatchEvent(new Event("online")); window.dispatchEvent(new Event("focus")); });
    await expect(page.getByText("Gate bread", { exact: true })).toBeVisible();
    expect(state.writes).toEqual(["Gate milk", "Gate bread"]);
  });
}

test("real network failure keeps the offline banner and queue behavior", async ({ page, context }) => {
  const state = await setup(page);
  // With workers blocked in the dev suite, warm the lazy sheet before going offline.
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Add Item", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close sheet", exact: true }).click({ position: { x: 10, y: 10 } });
  state.offline = true;
  await context.setOffline(true);
  // Invoke a normal app GET: failed request + failed health probe establish offline state.
  await page.evaluate(async () => {
    const { fetchList } = await import("/src/api/lists.ts");
    await fetchList(localStorage.getItem("endgame_grocery.auth_token"), "list-1");
  });
  await expect(page.getByText("Offline mode: cached data is available.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reconnect", exact: true })).toHaveCount(0);
  await addItem(page, "Offline milk");
  await expect(page.getByText("Offline mode: 1 change waiting to sync.", { exact: true })).toBeVisible();
  state.offline = false;
  await context.setOffline(false);
  await expect.poll(() => state.writes).toEqual(["Offline milk"]);
});
