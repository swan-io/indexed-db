import { Array, Future, Result } from "@swan-io/boxed";
import { createError, isDatabaseClosedError } from "./errors";
import { futurify } from "./futurify";
import { retry } from "./helpers";

type Config = {
  databaseName: string;
  storeName: string;
  transactionRetries: number;
  transactionTimeout: number;
};

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
        const onResolve = () => {
          clearInterval(intervalId);
          resolve(Result.Ok(indexedDB));
        };
        void indexedDB.databases().then(onResolve, onResolve);
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

const openDatabase = (config: Config): Future<Result<IDBDatabase, Error>> =>
  getFactory()
    .flatMapOk((factory) =>
      Future.value(
        Result.fromExecution<IDBOpenDBRequest, Error>(() =>
          factory.open(config.databaseName),
        ),
      ),
    )
    .flatMapOk((request) => {
      request.onupgradeneeded = () => {
        request.result.createObjectStore(config.storeName);
      };

      return futurify(request, "openDatabase", 1000);
    });

const getStore = (
  config: Config,
  database: IDBDatabase,
  mode: IDBTransactionMode,
): Future<Result<IDBObjectStore, Error>> =>
  Future.value(
    Result.fromExecution<IDBObjectStore, Error>(() =>
      database
        .transaction(config.storeName, mode)
        .objectStore(config.storeName),
    ),
  );

const getStoreWithReOpen = (
  config: Config,
  database: IDBDatabase,
  mode: IDBTransactionMode,
): Future<Result<IDBObjectStore, Error>> =>
  getStore(config, database, mode).flatMapError((error) => {
    if (!isDatabaseClosedError(error)) {
      return Future.value(Result.Error(error));
    }
    return openDatabase(config).flatMapOk((database) =>
      getStore(config, database, mode),
    );
  });

const request = <A, E>(
  config: Config,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => Future<Result<A, E>>,
) =>
  openDatabase(config).flatMapOk((database) =>
    retry(config.transactionRetries, () =>
      getStoreWithReOpen(config, database, mode).flatMapOk(callback),
    ).tap(() => database.close()),
  );

export const getStoreEntries = (
  config: Config,
): Future<Result<[string, unknown][], Error>> =>
  request(config, "readonly", (store) =>
    Future.all([
      futurify(store.getAllKeys(), "getEntries", config.transactionTimeout),
      futurify(store.getAll(), "getEntries", config.transactionTimeout),
    ])
      .map((results) => Result.all(results))
      .mapOk(([keys = [], values = []]) =>
        Array.zip(keys, values as unknown[]).filter(
          (pair): pair is [string, unknown] => typeof pair[0] === "string",
        ),
      ),
  );

export const setStoreEntries = (
  config: Config,
  entries: [string, unknown][],
): Future<Result<IDBValidKey[], Error>> =>
  request(config, "readwrite", (store) =>
    Future.all(
      entries.map(([key, value]) =>
        futurify(store.put(value, key), "setMany", config.transactionTimeout),
      ),
    ).map((results) => Result.all(results)),
  );

export const clearStore = (config: Config): Future<Result<void, Error>> =>
  request(config, "readwrite", (store) =>
    futurify(store.clear(), "clear", config.transactionTimeout),
  );
