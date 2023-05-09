import { Dict, Future, Result } from "@swan-io/boxed";
import { getIndexedDBFactory } from "./factory";
import { futurifyRequest, futurifyTransaction } from "./futurify";
import { retry, zipToObject } from "./helpers";
import { getInMemoryStore } from "./inMemoryStore";

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
    transactionTimeout = 300,
  } = options;

  const inMemoryStore = getInMemoryStore(databaseName, storeName);

  const databaseFuture = getIndexedDBFactory().flatMapOk((factory) => {
    const request = factory.open(databaseName);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName);
    };

    return futurifyRequest(request, "openDatabase", transactionTimeout);
  });

  const getObjectStore = (
    transactionMode: IDBTransactionMode,
  ): Future<Result<IDBObjectStore, DOMException>> =>
    databaseFuture.mapOk((database) =>
      database.transaction(storeName, transactionMode).objectStore(storeName),
    );

  return {
    getMany: <T extends string>(
      keys: T[],
    ): Future<Result<Record<T, unknown>, DOMException>> => {
      return retry(transactionRetries, () =>
        getObjectStore("readonly").flatMapOk((store) =>
          Future.all(
            keys.map((key) =>
              futurifyRequest(store.get(key), "getMany", transactionTimeout)
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
    ): Future<Result<void, DOMException>> => {
      const entries = Dict.entries(object);

      return retry(transactionRetries, () =>
        getObjectStore("readwrite").flatMapOk((store) => {
          entries.forEach(([key, value]) => store.put(value, key));

          return futurifyTransaction(
            store.transaction,
            "setMany",
            transactionTimeout,
          );
        }),
      ).tap(() => {
        if (enableInMemoryFallback) {
          entries.forEach(([key, value]) => {
            inMemoryStore.set(key, value);
          });
        }
      });
    },

    clear: (): Future<Result<void, DOMException>> => {
      return retry(transactionRetries, () =>
        getObjectStore("readwrite").flatMapOk((store) => {
          store.clear();

          return futurifyTransaction(
            store.transaction,
            "clear",
            transactionTimeout,
          );
        }),
      ).tapOk(() => {
        if (enableInMemoryFallback) {
          inMemoryStore.clear();
        }
      });
    },
  };
};
