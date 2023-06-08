import { expect, test } from "vitest";
import { createError, rewriteError } from "../src/errors";

test("rewriteError returns an unknown Error if null is passed", () => {
  const rewrittenError = rewriteError(null);

  expect(rewrittenError).toBeInstanceOf(Error);
  expect(rewrittenError.name).toBe("UnknownError");
  expect(rewrittenError.message).toBe("Unknown IndexedDB error");
});

test("rewriteError add context in case of InvalidStateError", () => {
  const error = createError("InvalidStateError", "NO_INITIAL_MESSAGE");
  const rewrittenError = rewriteError(error);

  expect(rewrittenError).toBeInstanceOf(Error);
  expect(rewrittenError.name).toBe("InvalidStateError");
  expect(error.stack).toStrictEqual(rewrittenError.stack);

  expect(rewrittenError.message).toBe(
    `Unable to open an IndexedDB connection. ` +
      `This could be due to running in a private browsing ` +
      `session on a browser whose private browsing ` +
      `sessions do not support IndexedDB: "NO_INITIAL_MESSAGE"`,
  );
});

test("rewriteError does nothing in case it seems to be an iOS 12.x error, but the platform doesn't match", () => {
  const error = createError(
    "UnknownError",
    "An internal error was encountered in the Indexed Database server",
  );

  const rewrittenError = rewriteError(error);

  expect(rewrittenError).toBeInstanceOf(Error);
  expect(rewrittenError.name).toBe("UnknownError");
  expect(error.stack).toStrictEqual(rewrittenError.stack);

  expect(rewrittenError.message).toBe(
    "An internal error was encountered in the Indexed Database server",
  );
});
