import { Future, Result } from "@swan-io/boxed";
import { createError, isDatabaseClosedError } from "./errors";
import { futurify } from "./futurify";

/**
 * Safari has a horrible bug where IndexedDB requests can hang forever.
 * We resolve this future with error after 100ms if it seems to happen.
 * @see https://bugs.webkit.org/show_bug.cgi?id=226547
 * @see https://github.com/jakearchibald/safari-14-idb-fix
 */
export const getFactory = (): Future<Result<IDBFactory, Error>> => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (indexedDB == null) {
    return Future.value(
      Result.Error(
        createError("indexedDB global doesn't exist", "UnknownError"),
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
    const accessIndexedDB = () => {
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
            createError("Couldn't list IndexedDB databases", "TimeoutError"),
          ),
        );
      }
    };

    intervalId = setInterval(accessIndexedDB, 100);
    accessIndexedDB();
  });
};

export const openDatabase = (
  databaseName: string,
  storeName: string,
): Future<Result<IDBDatabase, Error>> =>
  getFactory()
    .flatMapOk((factory) =>
      Future.value(
        Result.fromExecution<IDBOpenDBRequest, Error>(() =>
          factory.open(databaseName),
        ),
      ),
    )
    .flatMapOk((request) => {
      request.onupgradeneeded = () => {
        request.result.createObjectStore(storeName);
      };

      return futurify(request, "openDatabase", 1000);
    });

const getStoreRaw = (
  database: IDBDatabase,
  storeName: string,
  transactionMode: IDBTransactionMode,
): Future<Result<IDBObjectStore, Error>> =>
  Future.value(
    Result.fromExecution<IDBObjectStore, Error>(() =>
      database.transaction(storeName, transactionMode).objectStore(storeName),
    ),
  );

export const getStore = (
  database: IDBDatabase,
  databaseName: string,
  storeName: string,
  transactionMode: IDBTransactionMode,
): Future<Result<IDBObjectStore, Error>> =>
  getStoreRaw(database, storeName, transactionMode).flatMapError((error) =>
    !isDatabaseClosedError(error)
      ? Future.value(Result.Error(error))
      : openDatabase(databaseName, storeName).flatMapOk((database) =>
          getStoreRaw(database, storeName, transactionMode),
        ),
  );
