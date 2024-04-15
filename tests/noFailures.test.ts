import { afterEach, expect, test } from "vitest";
import { openStore } from "../src";

const store = await openStore("database", "store");

afterEach(async () => {
  await store.clear();
});

test("Happy path with no failures", { repeats: 1000 }, async () => {
  expect(await store.setMany({ A: true })).toBeUndefined();

  expect(await store.getMany(["A", "B"])).toStrictEqual({
    A: true,
    B: undefined,
  });

  expect(await store.setMany({ B: true })).toBeUndefined();
  expect(await store.getMany(["A", "B"])).toStrictEqual({ A: true, B: true });
  expect(await store.clear()).toBeUndefined();

  expect(await store.getMany(["A", "B"])).toStrictEqual({
    A: undefined,
    B: undefined,
  });

  expect(await store.setMany({ B: true })).toBeUndefined();

  expect(await store.getMany(["A", "B"])).toStrictEqual({
    A: undefined,
    B: true,
  });
});
