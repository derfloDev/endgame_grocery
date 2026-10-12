import { defineConfig, devices } from "@playwright/test";

// Production worker checks run separately from the development/API integration suite.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "push-notifications.spec.js",
  workers: 1,
  timeout: 30000,
  reporter: "list",
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:4173", serviceWorkers: "allow" },
  webServer: {
    command: "npm exec --workspace frontend -- vite preview --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173", reuseExistingServer: false, timeout: 30000
  }
});
