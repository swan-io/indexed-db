import { Result } from "@swan-io/boxed";
import { expect, test } from "vitest";
import { openStore } from "../src";
import { openDatabase } from "../src/wrappers";

const store = await openStore("database", "store");

test("Reopens closed database if required", async () => {
  expect(await store.setMany({ A: true })).toStrictEqual(Result.Ok(undefined));
  expect(await store.getMany(["A"])).toStrictEqual(Result.Ok({ A: true }));

  const database = await openDatabase("database", "store", 500);

  if (database.isError()) {
    throw database.getError();
  }

  database.get().close();
  await new Promise((resolve) => setTimeout(() => resolve, 500));

  expect(await store.getMany(["A"])).toStrictEqual(Result.Ok({ A: true }));
});
