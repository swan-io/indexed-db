import { Future, Lazy, Result } from "@swan-io/boxed";
import { retry } from "./retry";

// https://github.com/jakearchibald/safari-14-idb-fix/blob/v3.0.0/src/index.ts#L7
const isSafari = Lazy(
  () =>
    navigator.userAgentData != null &&
    /Safari\//.test(navigator.userAgent) &&
    !/Chrom(e|ium)\//.test(navigator.userAgent),
);

const iOSVersion = Lazy(() => {
  const versionMatch = navigator.userAgent.match(
    /i(?:phone|pad|pod) os ([\d_]+)/i,
  )?.[1];

  return versionMatch != null
    ? Number(versionMatch.split("_").slice(0, 2).join("."))
    : -1;
});

const transformError = (error: DOMException | null): Error => {
  if (error == null) {
    return new Error("Unknown IndexedDB error");
  }

  if (iOSVersion.get() >= 12.2 && iOSVersion.get() < 13) {
    const IOS_ERROR =
      "An internal error was encountered in the Indexed Database server";

    if (error.message.indexOf(IOS_ERROR) >= 0) {
      // https://bugs.webkit.org/show_bug.cgi?id=197050
      return new Error(
        `IndexedDB has thrown '${IOS_ERROR}'. This is likely ` +
          `due to an unavoidable bug in iOS. See https://stackoverflow.com/q/56496296/110915 ` +
          `for details and a potential workaround.`,
      );
    }
  }

  return error;
};

/**
 * Wraps an IDBRequest in a Future, using the onsuccess / onerror handlers
 * to resolve the Future as appropriate.
 * @see https://github.com/firebase/firebase-js-sdk/blob/master/packages/firestore/src/local/simple_db.ts#L895
 */
const futurifyRequest = <T>(request: IDBRequest<T>): Future<Result<T, Error>> =>
  Future.make((resolve) => {
    request.onsuccess = () => {
      resolve(Result.Ok(request.result));
    };
    request.onerror = () => {
      resolve(Result.Error(transformError(request.error)));
    };
  });

const futurifyTransaction = (
  transaction: IDBTransaction,
): Future<Result<undefined, Error>> =>
  Future.make((resolve) => {
    transaction.oncomplete = () => {
      resolve(Result.Ok(undefined));
    };
    transaction.onabort = () => {
      resolve(Result.Error(transformError(transaction.error)));
    };
    transaction.onerror = () => {
      resolve(Result.Error(transformError(transaction.error)));
    };
  });

/**
 * Work around Safari 14 IndexedDB open bug.
 *
 * Safari has a horrible bug where IDB requests can hang while the browser is starting up. https://bugs.webkit.org/show_bug.cgi?id=226547
 * The only solution is to keep nudging it until it's awake.
 *
 * @see https://github.com/jakearchibald/safari-14-idb-fix
 */

// Add a Promise.race like to abort open if it's stuck (add a setTimeout)
const openDatabase = (
  databaseName: string,
  storeName: string,
): Future<Result<IDBDatabase, Error>> =>
  Future.make((resolve) => {
    const request = indexedDB.open(databaseName);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName);
    };
    request.onsuccess = () => {
      resolve(Result.Ok(request.result));
    };
    request.onerror = () => {
      resolve(Result.Error(transformError(request.error)));
    };

    if (isSafari.get()) {
      // Safari has a horrible bug where IDB requests can hang forever
      // We reject this promise after 200ms if this seems to happen
      // @see https://bugs.webkit.org/show_bug.cgi?id=226547
      setTimeout(() => {
        const message = `Couldn't open ${databaseName} IndexedDB database`;
        resolve(Result.Error(new Error(message)));
      }, 200);
    }
  });

export const openStore = (databaseName: string, storeName: string) => {
  const databaseFuture = retry(() => openDatabase(databaseName, storeName));
  const inMemoryStore = new Map<string, unknown>();

  // All methods should fallback to inMemoryStore and fail only if the data doesn't exist in the store
  const getStore = (
    transactionMode: IDBTransactionMode,
  ): Future<Result<IDBObjectStore, Error>> =>
    databaseFuture.mapOk((database) =>
      database.transaction(storeName, transactionMode).objectStore(storeName),
    );

  return {
    getMany: (keys: string[]): Future<Result<unknown[], Error>> =>
      getStore("readonly").flatMapOk((store) =>
        Future.all(keys.map((key) => futurifyRequest(store.get(key)))).map(
          (futures) => Result.all(futures),
        ),
      ),

    setMany: (
      entries: [key: string, value: unknown][],
    ): Future<Result<undefined, Error>> =>
      getStore("readwrite").flatMapOk((store) => {
        entries.forEach((entry) => store.put(entry[1], entry[0]));
        return futurifyTransaction(store.transaction);
      }),

    clear: (): Future<Result<undefined, Error>> =>
      getStore("readwrite").flatMapOk((store) => {
        store.clear();
        return futurifyTransaction(store.transaction);
      }),
  };
};
