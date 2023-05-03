import { Result } from "@swan-io/boxed";
import { IDBFactory } from "fake-indexeddb";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { openStore } from "../../src";

beforeAll(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
});

afterAll(() => {
  vi.unstubAllGlobals();
});

test("happy path with no failures", async () => {
  const onError = vi.fn();
  const store = await openStore("database", "store", { onError });

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

  expect(onError).not.toHaveBeenCalled();
  expect(localStorage.getItem("idbClearableStores")).toBeNull();
});
