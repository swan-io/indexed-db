import { Dict, Future, Result } from "@swan-io/boxed";
import { getFactory } from "./factory";
import { futurify } from "./futurify";
import { retry, zipToObject } from "./helpers";
import { getInMemoryStore } from "./inMemoryStore";

const openDatabase = (
  databaseName: string,
  storeName: string,
  timeout: number,
): Future<Result<IDBDatabase, DOMException>> =>
  getFactory().flatMapOk((factory) => {
    const request = factory.open(databaseName);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName);
    };

    return futurify(request, timeout);
  });

const getStore = (
  database: IDBDatabase,
  storeName: string,
  transactionMode: IDBTransactionMode,
): Future<Result<IDBObjectStore, DOMException>> =>
  Future.value(
    Result.fromExecution<IDBObjectStore, DOMException>(() =>
      database.transaction(storeName, transactionMode).objectStore(storeName),
    ),
  );

export const openStore = (
  databaseName: string,
  storeName: string,
  options: {
    enableInMemoryFallback?: boolean;
    transactionRetries?: number;
    transactionTimeout?: number;
  } = {},
) => {
  const {
    enableInMemoryFallback = false,
    transactionRetries = 3,
    transactionTimeout = 500,
  } = options;

  const inMemoryStore = getInMemoryStore(databaseName, storeName);

  return {
    getMany: <T extends string>(
      keys: T[],
    ): Future<Result<Record<T, unknown>, DOMException>> => {
      return retry(transactionRetries, () =>
        openDatabase(databaseName, storeName, transactionTimeout)
          .flatMapOk((database) => getStore(database, storeName, "readonly"))
          .flatMapOk((store) =>
            Future.all(
              keys.map((key) =>
                futurify(store.get(key), transactionTimeout)
                  .mapOk((value: unknown) => {
                    if (!enableInMemoryFallback) {
                      return value;
                    }
                    if (typeof value === "undefined") {
                      return inMemoryStore.get(key);
                    }

                    inMemoryStore.set(key, value);
                    return value;
                  })
                  .mapErrorToResult((error) =>
                    enableInMemoryFallback
                      ? Result.Ok(inMemoryStore.get(key))
                      : Result.Error(error),
                  ),
              ),
            ).map((results) => Result.all(results)),
          ),
      )
        .mapOk((values) => zipToObject(keys, values))
        .mapErrorToResult((error) => {
          if (!enableInMemoryFallback) {
            return Result.Error(error);
          }

          const values = keys.map((key) => inMemoryStore.get(key));
          return Result.Ok(zipToObject(keys, values));
        });
    },

    setMany: (
      object: Record<string, unknown>,
    ): Future<Result<undefined, DOMException>> => {
      const entries = Dict.entries(object);

      return retry(transactionRetries, () =>
        openDatabase(databaseName, storeName, transactionTimeout)
          .flatMapOk((database) => getStore(database, storeName, "readwrite"))
          .flatMapOk((store) =>
            Future.all(
              entries.map(([key, value]) =>
                futurify(store.put(value, key), transactionTimeout),
              ),
            ).map((results) => Result.all(results)),
          ),
      )
        .mapOk(() => undefined)
        .tap(() => {
          if (enableInMemoryFallback) {
            entries.forEach(([key, value]) => {
              inMemoryStore.set(key, value);
            });
          }
        });
    },

    clear: (): Future<Result<undefined, DOMException>> => {
      return retry(transactionRetries, () =>
        openDatabase(databaseName, storeName, transactionTimeout)
          .flatMapOk((database) => getStore(database, storeName, "readwrite"))
          .flatMapOk((store) => futurify(store.clear(), transactionTimeout)),
      ).tapOk(() => {
        if (enableInMemoryFallback) {
          inMemoryStore.clear();
        }
      });
    },
  };
};
