import { Future, Lazy, Result } from "@swan-io/boxed";

// https://github.com/firebase/firebase-js-sdk/blob/firebase%409.20.0/packages/firestore/src/local/simple_db.ts#L241
export const iOSVersion = Lazy(() => {
  const versionMatch = navigator.userAgent.match(
    /i(?:phone|pad|pod) os ([\d_]+)/i,
  )?.[1];

  return versionMatch != null
    ? Number(versionMatch.split("_").slice(0, 2).join("."))
    : -1;
});

/**
 * Safari has a horrible bug where IndexedDB requests can hang forever.
 * We resolve this future with error after 100ms if it seems to happen.
 * @see https://bugs.webkit.org/show_bug.cgi?id=226547
 * @see https://github.com/jakearchibald/safari-14-idb-fix
 */
export const indexedDBReady = (): Future<Result<true, Error>> => {
  const isSafari =
    !navigator.userAgentData &&
    /Safari\//.test(navigator.userAgent) &&
    !/Chrom(e|ium)\//.test(navigator.userAgent);

  // No point putting other browsers or older versions of Safari through this mess.
  if (!isSafari || !("databases" in indexedDB)) {
    return Future.value(Result.Ok(true));
  }

  let intervalId: NodeJS.Timer;
  let remainingAttempts = 10;

  return Future.make((resolve) => {
    const tryToAccessIndexedDB = () => {
      remainingAttempts = remainingAttempts - 1;

      if (remainingAttempts > 0) {
        indexedDB.databases().finally(() => {
          clearInterval(intervalId);
          resolve(Result.Ok(true));
        });
      } else {
        clearInterval(intervalId);
        resolve(Result.Error(new Error("Couldn't list IndexedDB databases")));
      }
    };

    intervalId = setInterval(tryToAccessIndexedDB, 100);
    tryToAccessIndexedDB();
  });
};
