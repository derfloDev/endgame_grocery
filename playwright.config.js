import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "push-notifications.spec.js",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"]
      }
    }
  ],
  webServer: [
    {
      command: "npm run dev --workspace backend",
      // E2E setup creates verified users through /api/test/*, which is off unless opted in.
      env: { ENABLE_TEST_ROUTES: "true" },
      url: "http://localhost:4000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    },
    {
      command: "npm run dev --workspace frontend",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    }
  ]
});
