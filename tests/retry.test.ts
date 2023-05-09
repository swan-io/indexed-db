import { Future, Result } from "@swan-io/boxed";
import { expect, test } from "vitest";
import { retry } from "../src/helpers";

test("retry make 3 attempts if future resolve with error", async () => {
  let attempts = 0;

  const result = await retry(3, () => {
    return Future.make<Result<null, Error>>((resolve) => {
      attempts++;
      resolve(Result.Error(new Error("Foo")));
    });
  });

  expect(attempts).toBe(3);
  expect(result).toStrictEqual(Result.Error(new Error("Foo")));
});

test("retry make 10 attempts if maxAttemps is set to 10", async () => {
  let attempts = 0;

  const result = await retry(10, () => {
    return Future.make<Result<null, Error>>((resolve) => {
      attempts++;
      resolve(Result.Error(new Error("Foo")));
    });
  });

  expect(attempts).toBe(10);
  expect(result).toStrictEqual(Result.Error(new Error("Foo")));
});

test("retry make only 1 attempt if maxAttemps is set to <= 1", async () => {
  let attempts = 0;

  const result = await retry(-1, () => {
    return Future.make<Result<null, Error>>((resolve) => {
      attempts++;
      resolve(Result.Error(new Error("Foo")));
    });
  });

  expect(attempts).toBe(1);
  expect(result).toStrictEqual(Result.Error(new Error("Foo")));
});

test("retry make only 1 attempt if future resolve with ok", async () => {
  let attempts = 0;

  const result = await retry(3, () => {
    return Future.make<Result<null, Error>>((resolve) => {
      attempts++;
      resolve(Result.Ok(null));
    });
  });

  expect(attempts).toBe(1);
  expect(result).toStrictEqual(Result.Ok(null));
});

test("retry make 2 attempts if future resolve with ok the second time", async () => {
  let attempts = 0;

  const result = await retry(3, () => {
    return Future.make<Result<null, Error>>((resolve) => {
      attempts++;

      attempts === 2
        ? resolve(Result.Ok(null))
        : resolve(Result.Error(new Error("Foo")));
    });
  });

  expect(attempts).toBe(2);
  expect(result).toStrictEqual(Result.Ok(null));
});
