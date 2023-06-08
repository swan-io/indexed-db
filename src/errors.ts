import { Lazy } from "@swan-io/boxed";

// https://github.com/firebase/firebase-js-sdk/blob/firebase%409.20.0/packages/firestore/src/local/simple_db.ts#L241
const iOSVersion = Lazy(() => {
  const versionMatch = navigator.userAgent.match(
    /i(?:phone|pad|pod) os ([\d_]+)/i,
  )?.[1];

  return versionMatch != null
    ? Number(versionMatch.split("_").slice(0, 2).join("."))
    : -1;
});

export const createError = (message: string, name?: string): Error => {
  const error = new Error(message);

  if (name != null) {
    error.name = name;
  }

  return error;
};

const deriveError = (originalError: Error, newMessage: string): Error => {
  const newError = createError(newMessage, originalError.name);

  if (originalError.stack != null) {
    newError.stack = originalError.stack;
  }

  return newError;
};

export const rewriteError = (error: Error | null): Error => {
  if (error == null) {
    return createError("Unknown IndexedDB error", "UnknownError");
  }

  // https://github.com/firebase/firebase-js-sdk/blob/firebase%409.20.0/packages/firestore/src/local/simple_db.ts#L915
  if (iOSVersion.get() >= 12.2 && iOSVersion.get() < 13) {
    const IOS_ERROR =
      "An internal error was encountered in the Indexed Database server";

    if (error.message.indexOf(IOS_ERROR) >= 0) {
      return deriveError(
        error,
        `IndexedDB has thrown "${IOS_ERROR}". ` +
          `This is likely due to an unavoidable bug in iOS ` +
          `(https://bugs.webkit.org/show_bug.cgi?id=197050).`,
      );
    }
  }

  // https://github.com/firebase/firebase-js-sdk/blob/firebase%409.20.0/packages/firestore/src/local/simple_db.ts#L335
  if (error.name === "InvalidStateError") {
    return deriveError(
      error,
      `Unable to open an IndexedDB connection. ` +
        `This could be due to running in a private browsing ` +
        `session on a browser whose private browsing ` +
        `sessions do not support IndexedDB: "${error.message}"`,
    );
  }

  return error;
};

export const isDatabaseClosedError = (error: Error) =>
  error.message.indexOf("The database connection is closing") >= 0 ||
  error.message.indexOf("Can't start a transaction on a closed database") >= 0;
