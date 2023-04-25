import { iOSVersion } from "./userAgent";

export const rewriteError = (error: DOMException | null): Error => {
  if (error == null) {
    return new Error("Unknown IndexedDB error");
  }

  // https://github.com/firebase/firebase-js-sdk/blob/firebase%409.20.0/packages/firestore/src/local/simple_db.ts#L915
  if (iOSVersion.get() >= 12.2 && iOSVersion.get() < 13) {
    const IOS_ERROR =
      "An internal error was encountered in the Indexed Database server";

    if (error.message.indexOf(IOS_ERROR) >= 0) {
      return new Error(
        `IndexedDB has thrown '${IOS_ERROR}'. ` +
          `This is likely due to an unavoidable bug in iOS ` +
          `(https://bugs.webkit.org/show_bug.cgi?id=197050).`,
      );
    }
  }

  // https://github.com/firebase/firebase-js-sdk/blob/firebase%409.20.0/packages/firestore/src/local/simple_db.ts#L335
  if (error.name === "InvalidStateError") {
    return new Error(
      `Unable to open an IndexedDB connection. ` +
        `This could be due to running in a private browsing ` +
        `session on a browser whose private browsing ` +
        `sessions do not support IndexedDB: ${error.message}`,
    );
  }

  return error;
};
