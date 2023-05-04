import { Result } from "@swan-io/boxed";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { openStore } from "../src";

beforeAll(() => {
  vi.stubGlobal("indexedDB", undefined);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

test("API stays usable thanks to in-memory store", async () => {
  const store = await openStore("database", "storeA", {
    enableInMemoryFallback: true,
  });

  expect(await store.setMany({ A: true })).toStrictEqual(
    Result.Error(new DOMException("indexedDB global doesn't exist")),
  );

  expect(await store.getMany(["A", "B"])).toStrictEqual(
    Result.Ok({ A: true, B: undefined }),
  );

  expect(await store.setMany({ B: true })).toStrictEqual(
    Result.Error(new DOMException("indexedDB global doesn't exist")),
  );

  expect(await store.getMany(["A", "B"])).toStrictEqual(
    Result.Ok({ A: true, B: true }),
  );

  // in-memory store will not be wiped if indexedDB clear failed
  expect(await store.clear()).toStrictEqual(
    Result.Error(new DOMException("indexedDB global doesn't exist")),
  );

  expect(await store.getMany(["A", "B"])).toStrictEqual(
    Result.Ok({ A: true, B: true }),
  );
});

test("In-memory stores are preserved during session", async () => {
  const firstOpenedStore = await openStore("database", "storeB", {
    enableInMemoryFallback: true,
  });

  await firstOpenedStore.setMany({ A: true });

  const secondOpenedStore = await openStore("database", "storeB", {
    enableInMemoryFallback: true,
  });

  expect(await secondOpenedStore.getMany(["A", "B"])).toStrictEqual(
    Result.Ok({ A: true, B: undefined }),
  );
});

test("In-memory stores are created by database + store names", async () => {
  const firstOpenedStore = await openStore("database", "storeC", {
    enableInMemoryFallback: true,
  });

  await firstOpenedStore.setMany({ A: true });

  const secondOpenedStore = await openStore("database", "storeD", {
    enableInMemoryFallback: true,
  });

  expect(await secondOpenedStore.getMany(["A", "B"])).toStrictEqual(
    Result.Ok({ A: undefined, B: undefined }),
  );
});
