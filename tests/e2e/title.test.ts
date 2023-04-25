import { expect, test } from "@playwright/test";

test("has title", async ({ page }) => {
  await page.goto("https://www.swan.io");

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Swan/);
});
