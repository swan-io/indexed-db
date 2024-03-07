import { Array, Future, Result } from "@swan-io/boxed";
import { createError, isDatabaseClosedError } from "./errors";
import { futurify } from "./futurify";
import { retry } from "./helpers";

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
        createError("UnknownError", "indexedDB global doesn't exist"),
      ),
    );
  }

  const isSafari =
    !navigator.userAgentData &&
    /Safari\//.test(navigator.userAgent) &&
    !/Chrom(e|ium)\//.test(navigator.userAgent);

  if (!isSafari || !("databases" in indexedDB)) {
    return Future.value(Result.Ok(indexedDB));
  }

  let intervalId: number;
  let remainingAttempts = 10;

  return Future.make((resolve) => {
    const accessIndexedDB = () => {
      remainingAttempts = remainingAttempts - 1;

      if (remainingAttempts > 0) {
        void indexedDB.databases().finally(() => {
          clearInterval(intervalId);
          resolve(Result.Ok(indexedDB));
        });
      } else {
        clearInterval(intervalId);

        resolve(
          Result.Error(
            createError("TimeoutError", "Couldn't list IndexedDB databases"),
          ),
        );
      }
    };

    intervalId = setInterval(accessIndexedDB, 100);
    accessIndexedDB();
  });
};

const openDatabase = (
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

      return futurify(request);
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

const getStore = (
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

export const getStoreEntries = (
  databaseName: string,
  storeName: string,
): Future<Result<[IDBValidKey, unknown][], Error>> =>
  openDatabase(databaseName, storeName).flatMapOk((database) => {
    return retry(2, () =>
      getStore(database, databaseName, storeName, "readonly"),
    )
      .flatMapOk((store) =>
        Future.all([
          futurify(store.getAllKeys()),
          futurify(store.getAll()),
        ]).map((results) => Result.all(results)),
      )
      .mapOk(([keys = [], values = []]) => Array.zip(keys, values as unknown[]))
      .tap(() => database.close());
  });

export const setStoreEntries = (
  databaseName: string,
  storeName: string,
  entries: [IDBValidKey, unknown][],
): Future<void> =>
  openDatabase(databaseName, storeName)
    .flatMapOk((database) => {
      return retry(2, () =>
        getStore(database, databaseName, storeName, "readwrite"),
      )
        .flatMapOk((store) =>
          Future.all(
            entries.map(([key, value]) => futurify(store.put(value, key))),
          ).map((results) => Result.all(results)),
        )
        .tap(() => database.close());
    })
    .map(() => undefined);

export const clearStore = (
  databaseName: string,
  storeName: string,
): Future<void> =>
  openDatabase(databaseName, storeName)
    .flatMapOk((database) => {
      return retry(2, () =>
        getStore(database, databaseName, storeName, "readwrite"),
      )
        .flatMapOk((store) => futurify(store.clear()))
        .tap(() => database.close());
    })
    .map(() => undefined);
