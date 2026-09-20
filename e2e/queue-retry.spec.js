import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

async function setup(page) {
  await page.clock.install();
  await page.addInitScript(() => {
    localStorage.setItem("endgame_grocery.auth_token", "e30.eyJzdWIiOiJ1c2VyLTEifQ.test");
    localStorage.setItem("endgame_grocery.auth_user", JSON.stringify({ id: "user-1", display_name: "Tester" }));
    localStorage.setItem("i18nextLng", "en");
    window.EventSource = class extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSED = 2;
      readyState = 0;
      close() { this.readyState = 2; }
    };
  });
  const state = { writes: [], lists: [], failChild: true };
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "POST") {
      state.writes.push(path);
      if (path.endsWith("/entries") && state.failChild) {
        state.failChild = false;
        return route.fulfill({ status: 503, json: { error: "Temporary failure" } });
      }
      if (path === "/api/lists") state.lists = [{ id: "real-list", name: "Recovered list", is_owner: true }];
      return route.fulfill({ json: { list: state.lists[0], entry: { id: "real-entry" } } });
    }
    return route.fulfill({ json: path === "/api/lists" ? { lists: state.lists } : {} });
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Add", exact: true })).toBeVisible();
  // Use the browser clock and a future instant so RPC latency cannot turn this into a past date.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60_000));
  return state;
}

async function seedQueue(page) {
  await page.evaluate(async () => {
    const store = await import("/src/api/offlineStore.ts");
    const common = { token: "token", method: "POST", payload: { name: "Recovered list" } };
    await store.enqueueOfflineMutation({ ...common, id: "parent", url: "/api/lists", createdAt: "2026-01-01T00:00:00Z", queueMeta: { tempId: "temp-list", resourceType: "list" } });
    await store.enqueueOfflineMutation({ ...common, id: "child", url: "/api/lists/temp-list/entries", createdAt: "2026-01-01T00:00:01Z" });
    window.dispatchEvent(new Event("pageshow"));
  });
}

test("automatically retries a transient failure after waking and keeps the error banner quiet", async ({ page }) => {
  const state = await setup(page);
  await seedQueue(page);
  await expect.poll(() => state.writes.length).toBe(2);
  await expect(page.getByText("1 queued change still waiting to sync.", { exact: true })).toBeVisible();
  await expect(page.getByText("Temporary failure", { exact: true })).toHaveCount(0);
  await page.clock.runFor(1000);
  await expect.poll(() => state.writes.length).toBe(3);
  expect(state.writes).toEqual(["/api/lists", "/api/lists/real-list/entries", "/api/lists/real-list/entries"]);
  await expect(page.getByText("Recovered list", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(async () => (await (await import("/src/api/offlineStore.ts")).listOfflineMutations()).length)).toBe(0);
});

test("persists accepted temporary IDs through a reload without resending the parent", async ({ page }) => {
  const state = await setup(page);
  await seedQueue(page);
  await expect.poll(() => state.writes.length).toBe(2);
  await expect(page.getByText("1 queued change still waiting to sync.", { exact: true })).toBeVisible();
  await page.clock.resume();
  await page.reload();
  await expect.poll(() => state.writes.length).toBe(3);
  expect(state.writes).toEqual(["/api/lists", "/api/lists/real-list/entries", "/api/lists/real-list/entries"]);
  await expect.poll(() => page.evaluate(async () => (await (await import("/src/api/offlineStore.ts")).listOfflineMutations()).length)).toBe(0);
});
