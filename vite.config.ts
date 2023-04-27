import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["./tests/unit/**/*.test.ts"],
    setupFiles: ["fake-indexeddb/auto"],
    watch: false,
  },
});
