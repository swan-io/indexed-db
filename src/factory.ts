import { Future, Result } from "@swan-io/boxed";

/**
 * Safari has a horrible bug where IndexedDB requests can hang forever.
 * We resolve this future with error after 100ms if it seems to happen.
 * @see https://bugs.webkit.org/show_bug.cgi?id=226547
 * @see https://github.com/jakearchibald/safari-14-idb-fix
 */
export const getIndexedDBFactory = (): Future<
  Result<IDBFactory, DOMException>
> => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (indexedDB == null) {
    return Future.value(
      Result.Error(
        new DOMException("indexedDB global doesn't exist", "UnknownError"),
      ),
    );
  }

  const isSafari =
    !navigator.userAgentData &&
    /Safari\//.test(navigator.userAgent) &&
    !/Chrom(e|ium)\//.test(navigator.userAgent);

  // No point putting other browsers or older versions of Safari through this mess.
  if (!isSafari || !("databases" in indexedDB)) {
    return Future.value(Result.Ok(indexedDB));
  }

  let intervalId: NodeJS.Timer;
  let remainingAttempts = 10;

  return Future.make((resolve) => {
    const tryToAccessIndexedDB = () => {
      remainingAttempts = remainingAttempts - 1;

      if (remainingAttempts > 0) {
        indexedDB.databases().finally(() => {
          clearInterval(intervalId);
          resolve(Result.Ok(indexedDB));
        });
      } else {
        clearInterval(intervalId);

        resolve(
          Result.Error(
            new DOMException(
              "Couldn't list IndexedDB databases",
              "TimeoutError",
            ),
          ),
        );
      }
    };

    intervalId = setInterval(tryToAccessIndexedDB, 100);
    tryToAccessIndexedDB();
  });
};
