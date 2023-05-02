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

  expect(await store.setMany({ a: true })).toStrictEqual(
    Result.Error(new DOMException()),
  );

  expect(await store.getMany(["a", "b"])).toStrictEqual(
    Result.Ok({ a: true, b: undefined }),
  );

  expect(await store.setMany({ b: true })).toStrictEqual(Result.Ok(undefined));

  expect(await store.getMany(["a", "b"])).toStrictEqual(
    Result.Ok({ a: true, b: true }),
  );

  expect(await store.clear()).toStrictEqual(Result.Ok(undefined));

  expect(await store.getMany(["a", "b"])).toStrictEqual(
    Result.Ok({ a: undefined, b: undefined }),
  );

  expect(await store.setMany({ b: true })).toStrictEqual(Result.Ok(undefined));

  expect(await store.getMany(["a", "b"])).toStrictEqual(
    Result.Ok({ a: undefined, b: true }),
  );
});

test("In-memory stores are preserved during session", async () => {
  const store = await openStore("database", "store");

  expect(await store.getMany(["a", "b"])).toStrictEqual(
    Result.Ok({ a: undefined, b: true }),
  );
});
