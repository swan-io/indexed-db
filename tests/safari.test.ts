import { Result } from "@swan-io/boxed";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { rewriteError } from "../src/errors";
import { getFactory } from "../src/factory";

const userAgents = {
  "12.2":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1",
  "14.6":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1",
};

describe("Safari 12.2", () => {
  beforeAll(() => {
    vi.stubGlobal("navigator", {
      userAgent: userAgents["12.2"],
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  test("rewriteError add context in case of an unknown iOS 12.x error", () => {
    const ios12Error = new DOMException(
      "An internal error was encountered in the Indexed Database server",
      "UnknownError",
    );

    const rewrittenError = rewriteError(ios12Error);

    expect(rewrittenError).toBeInstanceOf(DOMException);
    expect(rewrittenError.name).toBe("UnknownError");
    expect(rewrittenError.stack).toStrictEqual(ios12Error.stack);

    expect(rewrittenError.message).toBe(
      `IndexedDB has thrown "An internal error was encountered in the Indexed Database server". ` +
        `This is likely due to an unavoidable bug in iOS ` +
        `(https://bugs.webkit.org/show_bug.cgi?id=197050).`,
    );
  });
});

describe("Safari 14.6 (unresponsive)", () => {
  beforeAll(() => {
    vi.stubGlobal("indexedDB", {
      ...indexedDB,
      databases: () => new Promise<IDBDatabaseInfo[]>(() => {}),
    });

    vi.stubGlobal("navigator", {
      userAgent: userAgents["14.6"],
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  test("getFactory resolve with error if indexedDB.databases hangs forever", async () => {
    const result = await getFactory();

    expect(result).toStrictEqual(
      Result.Error(new DOMException("Couldn't list IndexedDB databases")),
    );
  });
});

describe("Safari 14.6 (unresponsive at first)", () => {
  beforeAll(() => {
    let attempts = 0;

    vi.stubGlobal("indexedDB", {
      ...indexedDB,
      databases: () =>
        new Promise<IDBDatabaseInfo[]>((resolve) => {
          attempts++;
          attempts === 5 && resolve([]);
        }),
    });

    vi.stubGlobal("navigator", {
      userAgent: userAgents["14.6"],
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  test("getFactory resolve with ok if indexedDB.databases resolve after a while", async () => {
    const result = await getFactory();
    expect(result).toStrictEqual(Result.Ok(indexedDB));
  });
});

describe("Safari 14.6 (responsive)", () => {
  beforeAll(() => {
    vi.stubGlobal("navigator", {
      userAgent: userAgents["14.6"],
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  test("getFactory resolve with ok if indexedDB.databases resolve immediately", async () => {
    const result = await getFactory();
    expect(result).toStrictEqual(Result.Ok(indexedDB));
  });
});

describe("Safari 14.6 (responsive, but too late)", () => {
  beforeAll(() => {
    let attempts = 0;

    vi.stubGlobal("indexedDB", {
      ...indexedDB,
      databases: () =>
        new Promise<IDBDatabaseInfo[]>((resolve) => {
          attempts++;
          attempts === 15 && resolve([]);
        }),
    });

    vi.stubGlobal("navigator", {
      userAgent: userAgents["14.6"],
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  test("getFactory resolve with error if indexedDB.databases hangs for too long", async () => {
    const result = await getFactory();

    expect(result).toStrictEqual(
      Result.Error(new DOMException("Couldn't list IndexedDB databases")),
    );
  });
});
