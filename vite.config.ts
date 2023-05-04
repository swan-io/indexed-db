import { defineConfig } from "vitest/config";

const BROWSER = process.env.BROWSER ?? "chromium";
const CI = process.env.CI === String(true);

export default defineConfig({
  test: {
    include: ["./tests/**/*.test.ts"],
    threads: false,
    watch: false,
    browser: {
      enabled: true,
      headless: CI,
      name: BROWSER,
      provider: "playwright",
    },
  },
});
