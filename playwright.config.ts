import { defineConfig, devices } from "@playwright/test";

const CI = process.env.CI === String(true);

export default defineConfig({
  forbidOnly: CI,
  reporter: [["line"], ["html"]],
  testDir: "./tests/e2e",

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        headless: CI,
      },
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        headless: CI,
      },
    },
    {
      name: "safari",
      use: {
        ...devices["Desktop Safari"],
        headless: CI,
      },
    },
  ],
});
