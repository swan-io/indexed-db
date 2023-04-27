import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { rewriteError } from "../../src/errors";

beforeAll(() => {
  vi.stubGlobal("navigator", {
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1",
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

test("rewriteError add context in case of an unknown iOS 12.x error", () => {
  const error = new DOMException(
    "An internal error was encountered in the Indexed Database server",
    "UnknownError",
  );

  const rewrittenError = rewriteError(error);

  expect(rewrittenError).toStrictEqual(new DOMException());
  expect(rewrittenError.name).toBe("UnknownError");
  expect(error.stack).toStrictEqual(rewrittenError.stack);

  expect(rewrittenError.message).toBe(
    `IndexedDB has thrown 'An internal error was encountered in the Indexed Database server'. ` +
      `This is likely due to an unavoidable bug in iOS ` +
      `(https://bugs.webkit.org/show_bug.cgi?id=197050).`,
  );
});
