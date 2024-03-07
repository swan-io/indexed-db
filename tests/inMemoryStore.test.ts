import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { openStore } from "../src";

beforeAll(() => {
  vi.stubGlobal("indexedDB", undefined);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

test("API stays usable thanks to in-memory store", async () => {
  const store = await openStore("database", "storeA");

  expect(await store.setMany({ A: true })).toBeUndefined();

  expect(await store.getMany(["A", "B"])).toStrictEqual({
    A: true,
    B: undefined,
  });

  expect(await store.setMany({ B: true })).toBeUndefined();
  expect(await store.getMany(["A", "B"])).toStrictEqual({ A: true, B: true });

  // in-memory store will not be wiped if indexedDB clear failed
  // expect(await store.clear()).toBeUndefined();

  // expect(await store.getMany(["A", "B"])).toStrictEqual({ A: true, B: true });
});

test.skip("In-memory stores are preserved during session", async () => {
  const firstOpenedStore = await openStore("database", "storeB");

  await firstOpenedStore.setMany({ A: true });

  const secondOpenedStore = await openStore("database", "storeB");

  expect(await secondOpenedStore.getMany(["A", "B"])).toStrictEqual({
    A: true,
    B: undefined,
  });
});

test.skip("In-memory stores are created by database + store names", async () => {
  const firstOpenedStore = await openStore("database", "storeC");

  await firstOpenedStore.setMany({ A: true });

  const secondOpenedStore = await openStore("database", "storeD");

  expect(await secondOpenedStore.getMany(["A", "B"])).toStrictEqual({
    A: undefined,
    B: undefined,
  });
});
