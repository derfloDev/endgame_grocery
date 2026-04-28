import { expect, test } from "@playwright/test";

const STORAGE_KEY = "endgame_grocery.auth_token";
const TEST_PASSWORD = "password123";

function uniqueEmail(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@e2e.test`;
}

test.use({ hasTouch: true });

async function setupLoggedInUser(page, request) {
  const email = uniqueEmail("lists");

  const registerResponse = await request.post("/api/test/create-verified-user", {
    data: {
      display_name: "List Tester",
      email,
      password: TEST_PASSWORD
    }
  });
  expect(registerResponse.ok()).toBeTruthy();
  const { token } = await registerResponse.json();

  await page.goto("/");
  await page.evaluate(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: STORAGE_KEY, value: token }
  );
  await page.goto("/");
  await page.waitForURL("/");

  return { token };
}

async function createListByApi(request, token, name) {
  const response = await request.post("/api/lists", {
    data: { name },
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  expect(response.ok()).toBeTruthy();

  return (await response.json()).list;
}

async function createEntryByApi(request, token, listId, text) {
  const response = await request.post(`/api/lists/${listId}/entries`, {
    data: { text },
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  expect(response.ok()).toBeTruthy();

  return (await response.json()).entry;
}

async function swipeEntryLeft(page, entryText) {
  const row = page.locator(".entry-row").filter({ hasText: entryText });
  await expect(row).toBeVisible();

  const box = await row.boundingBox();
  expect(box).toBeTruthy();

  const startX = box.x + box.width - 20;
  const endX = box.x + box.width - 115;
  const y = box.y + box.height / 2;

  await page.evaluate(
    ({ text, sx, ex, yPos }) => {
      const element = [...document.querySelectorAll(".entry-row")].find((node) => node.textContent?.includes(text));

      if (!element) {
        throw new Error(`Entry row not found for ${text}`);
      }

      const touchData = (x) =>
        new Touch({
          identifier: 1,
          target: element,
          clientX: x,
          clientY: yPos,
          pageX: x,
          pageY: yPos,
          screenX: x,
          screenY: yPos
        });

      const buildEvent = (type, touches, changedTouches) =>
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          touches,
          targetTouches: touches,
          changedTouches
        });

      element.dispatchEvent(buildEvent("touchstart", [touchData(sx)], [touchData(sx)]));
      element.dispatchEvent(buildEvent("touchmove", [touchData(ex)], [touchData(ex)]));
      element.dispatchEvent(buildEvent("touchend", [], [touchData(ex)]));
    },
    { text: entryText, sx: startX, ex: endX, yPos: y }
  );
}

test.describe("shopping lists", () => {
  test("creates a new shopping list", async ({ page, request }) => {
    await setupLoggedInUser(page, request);

    const listName = `Mission ${Date.now()}`;

    await page.getByRole("button", { name: "Add" }).click();
    const newListSheet = page.getByRole("dialog", { name: "New List" });
    await expect(newListSheet).toBeVisible();

    await newListSheet.getByRole("textbox", { name: "New list" }).fill(listName);
    await page.getByRole("button", { name: "Create list" }).click();

    await expect(page.getByText(listName)).toBeVisible();
  });

  test("adds an item to a shopping list", async ({ page, request }) => {
    const { token } = await setupLoggedInUser(page, request);
    const list = await createListByApi(request, token, "Avengers Pantry");

    await page.goto(`/lists/${list.id}`);

    const itemText = `Mjolnir ${Date.now()}`;

    await page.getByRole("button", { name: "Add" }).click();
    const addItemSheet = page.getByRole("dialog", { name: "Add Item" });
    await expect(addItemSheet).toBeVisible();

    await addItemSheet.getByRole("textbox", { name: "Add item" }).fill(itemText);
    await page.getByRole("button", { name: "Add Item" }).click();

    await expect(page.getByText(itemText)).toBeVisible();
  });

  test("deletes an item from a shopping list via swipe", async ({ page, request }) => {
    const { token } = await setupLoggedInUser(page, request);
    const list = await createListByApi(request, token, "Quantum Realm Groceries");
    const itemText = `Pym Particles ${Date.now()}`;

    await createEntryByApi(request, token, list.id, itemText);
    await page.goto(`/lists/${list.id}`);

    await expect(page.getByText(itemText)).toBeVisible();

    await swipeEntryLeft(page, itemText);

    await expect(openItemsSection(page).getByText(itemText)).not.toBeVisible();
  });

  test("marks an item as done in a shopping list", async ({ page, request }) => {
    const { token } = await setupLoggedInUser(page, request);
    const list = await createListByApi(request, token, "Endgame Checklist");
    const itemText = `Infinity Stone ${Date.now()}`;

    await createEntryByApi(request, token, list.id, itemText);
    await page.goto(`/lists/${list.id}`);

    const toggleButton = page.getByRole("button", { name: `Mark ${itemText} done` });
    await expect(toggleButton).toBeVisible();

    await toggleButton.click();

    await expect(openItemsSection(page).getByText(itemText)).not.toBeVisible();
    await expect(recentlyUsedSection(page).getByText(itemText)).toBeVisible();
  });
});

function openItemsSection(page) {
  return page.locator(".entry-section").filter({ hasText: "OPEN ITEMS" });
}

function recentlyUsedSection(page) {
  return page.locator("section").filter({ hasText: "RECENTLY USED" });
}
