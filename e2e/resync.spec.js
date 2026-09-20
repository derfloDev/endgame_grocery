import { expect, test } from "@playwright/test";

// Exercise real page/provider integration with controlled transport and lifecycle events.
// API fixtures keep these recovery checks independent of a local PostgreSQL instance.
test.use({ serviceWorkers: "block" });

async function setupResyncPage(page) {
  const state = {
    lists: [{ id: "list-1", name: "Weekly groceries", is_owner: true }],
    entries: [{ id: "entry-1", text: "Milk", status: "open" }],
    counts: { lists: 0, entries: 0, history: 0, members: 0 }
  };
  await page.addInitScript(() => {
    window.localStorage.setItem("endgame_grocery.auth_token", "e30.eyJzdWIiOiJ1c2VyLTEifQ.test");
    window.localStorage.setItem("endgame_grocery.auth_user", JSON.stringify({ id: "user-1", display_name: "Tester", email: "tester@example.com" }));
    window.localStorage.setItem("i18nextLng", "en");
    class ControlledEventSource extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSED = 2;
      readyState = 0;
      constructor() {
        super();
        window.resyncTest.source = this;
        queueMicrotask(() => {
          if (this.readyState === ControlledEventSource.CLOSED) return;
          this.readyState = ControlledEventSource.OPEN;
          this.onopen?.(new Event("open"));
        });
      }
      close() { this.readyState = ControlledEventSource.CLOSED; }
    }
    window.resyncTest = {
      source: null,
      visibility(value) {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value });
        document.dispatchEvent(new Event("visibilitychange"));
      },
      reconnect() {
        this.source.readyState = ControlledEventSource.CLOSED;
        this.source.onerror?.(new Event("error"));
        window.dispatchEvent(new Event("online"));
      }
    };
    window.EventSource = ControlledEventSource;
  });
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let data = {};
    if (pathname === "/api/config") data = { registrationEnabled: true };
    if (pathname === "/api/auth/me") data = { user: { id: "user-1", display_name: "Tester" } };
    if (pathname === "/api/lists") {
      state.counts.lists += 1;
      data = { lists: state.lists };
    }
    if (pathname === "/api/lists/list-1/entries") {
      state.counts.entries += 1;
      data = { entries: state.entries };
    }
    if (pathname === "/api/lists/list-1/history") {
      state.counts.history += 1;
      data = { history: [] };
    }
    if (pathname === "/api/lists/list-1/members") {
      state.counts.members += 1;
      data = { members: [] };
    }
    await route.fulfill({ json: data });
  });
  return state;
}

test("refreshes overview changes made while the page was hidden", async ({ page }) => {
  const state = await setupResyncPage(page);
  await page.goto("/");
  await expect(page.getByText("Weekly groceries")).toBeVisible();
  const previousRequests = state.counts.lists;
  await page.evaluate(() => window.resyncTest.visibility("hidden"));
  state.lists = [{ ...state.lists[0], name: "Renamed while hidden" }];
  await page.evaluate(() => window.resyncTest.visibility("visible"));
  await expect(page.getByText("Renamed while hidden")).toBeVisible();
  expect(state.counts.lists).toBe(previousRequests + 1);
});

test("reconnect plus foreground refreshes detail once and keeps content visible", async ({ page }) => {
  const state = await setupResyncPage(page);
  await page.goto("/lists/list-1");
  await expect(page.getByText("Milk", { exact: true })).toBeVisible();
  const previousRequests = { ...state.counts };
  let releaseResponse;
  const responseGate = new Promise((resolve) => { releaseResponse = resolve; });
  await page.route("**/api/lists/list-1/entries", async (route) => {
    state.counts.entries += 1;
    await responseGate;
    await route.fulfill({ json: { entries: [{ id: "entry-2", text: "Bread", status: "open" }] } });
  });
  try {
    await page.evaluate(async () => {
      window.resyncTest.visibility("hidden");
      window.resyncTest.reconnect();
      await Promise.resolve();
      window.resyncTest.visibility("visible");
    });
    await expect.poll(() => state.counts.entries).toBe(previousRequests.entries + 1);
    await expect(page.getByText("Milk", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Loading", { exact: true })).toHaveCount(0);
  } finally {
    releaseResponse();
  }
  await expect(page.getByText("Bread", { exact: true })).toBeVisible();
  await expect.poll(() => state.counts.history).toBe(previousRequests.history + 1);
  await expect.poll(() => state.counts.members).toBe(previousRequests.members + 1);
  expect(state.counts.entries).toBe(previousRequests.entries + 1);
  expect(state.counts.lists).toBe(previousRequests.lists);
});
