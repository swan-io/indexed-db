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
  // TODO: Add ECDSA private key store with JWK export, just to try
  const store = await openStore("database", "store");

  await store.setMany({ foo: true });
  const result = await store.getMany(["foo", "bar"]);

  expect(result).toStrictEqual(Result.Ok({ foo: true, bar: undefined }));
});
