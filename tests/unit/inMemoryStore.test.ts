import { Result } from "@swan-io/boxed";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { openStore } from "../../src/index";

beforeAll(() => {
  vi.stubGlobal("indexedDB", undefined);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

test("API stays usable thanks to in-memory store", async () => {
  const store = await openStore("database", "store");

  await store.setMany({ test: true });
  const result = await store.getMany(["test"]);

  expect(result).toStrictEqual(Result.Ok({ test: true }));
});
