import { Future, Result } from "@swan-io/boxed";
import { rewriteError } from "./errors";
import { futurifyRequest, futurifyTransaction } from "./futurify";
import { retry } from "./retry";
import { isSafari } from "./safari";

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
      resolve(Result.Error(rewriteError(request.error)));
    };

    if (isSafari.get()) {
      /**
       * Safari has a horrible bug where IDB requests can hang forever.
       * We resolve this future with error after 200ms if it seems to happen.
       * @see https://bugs.webkit.org/show_bug.cgi?id=226547
       */
      setTimeout(() => {
        const ERROR = `Couldn't open ${databaseName} IndexedDB database`;
        resolve(Result.Error(new Error(ERROR)));
      }, 200);
    }
  });

export const openStore = (databaseName: string, storeName: string) => {
  const databaseFuture = retry(() => openDatabase(databaseName, storeName));
  // const inMemoryStore = new Map<string, unknown>();

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
