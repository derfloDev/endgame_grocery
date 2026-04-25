import { expect, test } from "@playwright/test";

const TEST_PASSWORD = "password123";

function uniqueEmail(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@e2e.test`;
}

async function fillRegistrationForm(page, { displayName, email, password = TEST_PASSWORD }) {
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
}

async function fillLoginForm(page, { email, password }) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
}

async function registerByApi(request, { displayName, email, password = TEST_PASSWORD }) {
  const response = await request.post("/api/auth/register", {
    data: {
      display_name: displayName,
      email,
      password
    }
  });

  expect(response.ok()).toBeTruthy();
}

test.describe("registration", () => {
  test("registers a new user and lands on the protected overview", async ({ page }) => {
    const email = uniqueEmail("register");

    await page.goto("/register");
    await fillRegistrationForm(page, {
      displayName: "E2E Register",
      email
    });
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("No lists yet")).toBeVisible();
  });

  test("shows an error when the email is already registered", async ({ page }) => {
    const email = uniqueEmail("duplicate");

    await page.goto("/register");
    await fillRegistrationForm(page, {
      displayName: "First Pass",
      email
    });
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.context().clearCookies();
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    await page.goto("/register");
    await fillRegistrationForm(page, {
      displayName: "Second Pass",
      email
    });
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("An account with that email already exists.")).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });
});

test.describe("login", () => {
  test("logs in an existing user and lands on the protected overview", async ({ page, request }) => {
    const email = uniqueEmail("login");

    await registerByApi(request, {
      displayName: "Login Setup",
      email
    });

    await page.goto("/login");
    await fillLoginForm(page, {
      email,
      password: TEST_PASSWORD
    });
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("No lists yet")).toBeVisible();
  });

  test("shows an error for a wrong password", async ({ page, request }) => {
    const email = uniqueEmail("wrong_password");

    await registerByApi(request, {
      displayName: "Wrong Password",
      email
    });

    await page.goto("/login");
    await fillLoginForm(page, {
      email,
      password: "incorrect-password"
    });
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText("Invalid email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("shows an error for an unknown email", async ({ page }) => {
    await page.goto("/login");
    await fillLoginForm(page, {
      email: uniqueEmail("unknown"),
      password: TEST_PASSWORD
    });
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText("Invalid email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
