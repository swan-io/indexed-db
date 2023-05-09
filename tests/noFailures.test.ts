import { Result } from "@swan-io/boxed";
import { afterEach, expect, test } from "vitest";
import { openStore } from "../src";

const store = await openStore("database", "store");

afterEach(async () => {
  await store.clear();
});

test(
  "happy path with no failures",
  async () => {
    expect(await store.setMany({ A: true })).toStrictEqual(
      Result.Ok(undefined),
    );

    expect(await store.getMany(["A", "B"])).toStrictEqual(
      Result.Ok({ A: true, B: undefined }),
    );

    expect(await store.setMany({ B: true })).toStrictEqual(
      Result.Ok(undefined),
    );

    expect(await store.getMany(["A", "B"])).toStrictEqual(
      Result.Ok({ A: true, B: true }),
    );

    expect(await store.clear()).toStrictEqual(Result.Ok(undefined));

    expect(await store.getMany(["A", "B"])).toStrictEqual(
      Result.Ok({ A: undefined, B: undefined }),
    );

    expect(await store.setMany({ B: true })).toStrictEqual(
      Result.Ok(undefined),
    );

    expect(await store.getMany(["A", "B"])).toStrictEqual(
      Result.Ok({ A: undefined, B: true }),
    );
  },
  {
    repeats: 1000,
  },
);
