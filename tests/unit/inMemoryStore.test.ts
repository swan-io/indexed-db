import { Result } from "@swan-io/boxed";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { openStore } from "../../src";

beforeAll(() => {
  vi.stubGlobal("indexedDB", undefined);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

test("API stays usable thanks to in-memory store", async () => {
  const onError = vi.fn();
  const store = await openStore("database", "storeA", { onError });

  expect(await store.setMany({ A: true })).toStrictEqual(Result.Ok(undefined));

  expect(await store.getMany(["A", "B"])).toStrictEqual(
    Result.Ok({ A: true, B: undefined }),
  );

  expect(await store.setMany({ B: true })).toStrictEqual(Result.Ok(undefined));

  expect(await store.getMany(["A", "B"])).toStrictEqual(
    Result.Ok({ A: true, B: true }),
  );

  expect(await store.clear()).toStrictEqual(Result.Ok(undefined));

  expect(await store.getMany(["A", "B"])).toStrictEqual(
    Result.Ok({ A: undefined, B: undefined }),
  );

  expect(await store.setMany({ B: true })).toStrictEqual(Result.Ok(undefined));

  expect(await store.getMany(["A", "B"])).toStrictEqual(
    Result.Ok({ A: undefined, B: true }),
  );

  expect(onError).toHaveBeenCalledTimes(1);
  expect(onError).toHaveBeenCalledWith(new DOMException());

  expect(localStorage.getItem("idbClearableStores")).toStrictEqual(
    JSON.stringify([["database", "storeA"]]),
  );
});

test("In-memory stores are preserved during session", async () => {
  const firstOpenedStore = await openStore("database", "storeB");
  await firstOpenedStore.setMany({ A: true });
  const secondOpenedStore = await openStore("database", "storeB");

  expect(await secondOpenedStore.getMany(["A", "B"])).toStrictEqual(
    Result.Ok({ A: true, B: undefined }),
  );
});

test("In-memory stores are created by database + store names", async () => {
  const firstOpenedStore = await openStore("database", "storeC");
  await firstOpenedStore.setMany({ A: true });
  const secondOpenedStore = await openStore("database", "storeD");

  expect(await secondOpenedStore.getMany(["A", "B"])).toStrictEqual(
    Result.Ok({ A: undefined, B: undefined }),
  );
});
