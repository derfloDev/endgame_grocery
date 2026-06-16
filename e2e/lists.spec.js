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

test.describe("shopping lists", () => {
  test("keeps overview controls visible without clipping the brand", async ({ page, request }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await setupLoggedInUser(page, request);

    for (const width of [320, 900]) {
      await page.setViewportSize({ width, height: 640 });

      const title = page.getByText("ENDGAME");
      const subtitle = page.getByText("GROCERY");
      const settingsButton = page.getByRole("button", { name: "Settings" });
      const sortSelect = page.getByRole("combobox", { name: "Sort lists" });
      const logo = page.getByRole("img", { name: "Endgame Grocery" });

      await expect(title).toBeVisible();
      await expect(subtitle).toBeVisible();
      await expect(settingsButton).toBeVisible();
      await expect(sortSelect).toBeVisible();

      const titleBox = await title.boundingBox();
      const subtitleBox = await subtitle.boundingBox();
      const settingsBox = await settingsButton.boundingBox();
      const sortBox = await sortSelect.boundingBox();
      const logoBox = await logo.boundingBox();

      expect(titleBox).toBeTruthy();
      expect(subtitleBox).toBeTruthy();
      expect(settingsBox).toBeTruthy();
      expect(sortBox).toBeTruthy();
      expect(logoBox).toBeTruthy();

      const brandBottom = Math.max(
        titleBox.y + titleBox.height,
        subtitleBox.y + subtitleBox.height,
        settingsBox.y + settingsBox.height,
        logoBox.y + logoBox.height
      );

      for (const box of [titleBox, subtitleBox, settingsBox, sortBox]) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }

      await expect(title.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).resolves.toBe(true);
      await expect(subtitle.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).resolves.toBe(true);
      expect(sortBox.y).toBeGreaterThanOrEqual(brandBottom);
    }
  });

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
