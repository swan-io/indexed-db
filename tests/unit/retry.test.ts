import { Future, Result } from "@swan-io/boxed";
import { expect, test } from "vitest";
import { retry } from "../../src/retry";

test("retry make 3 attempts if future resolve with error", async () => {
  let counter = 0;

  const result = await retry(() => {
    return Future.make<Result<null, Error>>((resolve) => {
      counter++;
      resolve(Result.Error(new Error("Foo")));
    });
  });

  expect(counter).toBe(3);
  expect(result).toEqual(Result.Error(new Error("Foo")));
});

test("retry make 10 attempts if maxAttemps is set to 10", async () => {
  let counter = 0;

  const result = await retry(() => {
    return Future.make<Result<null, Error>>((resolve) => {
      counter++;
      resolve(Result.Error(new Error("Foo")));
    });
  }, 10);

  expect(counter).toBe(10);
  expect(result).toEqual(Result.Error(new Error("Foo")));
});

test("retry make only 1 attempt if maxAttemps is set to <= 1", async () => {
  let counter = 0;

  const result = await retry(() => {
    return Future.make<Result<null, Error>>((resolve) => {
      counter++;
      resolve(Result.Error(new Error("Foo")));
    });
  }, -1);

  expect(counter).toBe(1);
  expect(result).toEqual(Result.Error(new Error("Foo")));
});

test("retry make only 1 attempt if future resolve with ok", async () => {
  let counter = 0;

  const result = await retry(() => {
    return Future.make<Result<null, Error>>((resolve) => {
      counter++;
      resolve(Result.Ok(null));
    });
  });

  expect(counter).toBe(1);
  expect(result).toEqual(Result.Ok(null));
});

test("retry make 2 attempts if future resolve with ok the second time", async () => {
  let counter = 0;

  const result = await retry(() => {
    return Future.make<Result<null, Error>>((resolve) => {
      counter++;

      counter === 2
        ? resolve(Result.Ok(null))
        : resolve(Result.Error(new Error("Foo")));
    });
  });

  expect(counter).toBe(2);
  expect(result).toEqual(Result.Ok(null));
});
