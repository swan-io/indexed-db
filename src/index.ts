import { Dict, Future, Result } from "@swan-io/boxed";
import { getIndexedDBFactory } from "./factory";
import { futurifyRequest, futurifyTransaction } from "./futurify";
import { retry, zipToObject } from "./helpers";
import { getInMemoryStore } from "./inMemoryStore";

export const openStore = (
  databaseName: string,
  storeName: string,
  options: { allowInMemoryFallback?: boolean } = {},
) => {
  const { allowInMemoryFallback = false } = options;
  const inMemoryStore = getInMemoryStore(databaseName, storeName);

  const databaseFuture = getIndexedDBFactory().flatMapOk((factory) => {
    const request = factory.open(databaseName);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName);
    };

    return futurifyRequest("openDatabase", request);
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
      return retry(() =>
        getObjectStore("readonly").flatMapOk((store) =>
          Future.all(
            keys.map((key) => futurifyRequest("getMany", store.get(key))),
          ).map((results) => Result.all(results)),
        ),
      )
        .mapOk((data: unknown[]) => {
          const values = data.map((value: unknown, index) => {
            const key = keys[index];

            if (typeof key === "undefined") {
              return value;
            }
            if (typeof value === "undefined" && allowInMemoryFallback) {
              return inMemoryStore.get(key);
            }
            if (allowInMemoryFallback) {
              inMemoryStore.set(key, value);
            }

            return value;
          });

          return zipToObject(keys, values);
        })
        .mapErrorToResult((error) => {
          if (!allowInMemoryFallback) {
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

      return retry(() =>
        getObjectStore("readwrite").flatMapOk((store) => {
          entries.forEach(([key, value]) => store.put(value, key));
          return futurifyTransaction("setMany", store.transaction);
        }),
      ).tap(() => {
        if (allowInMemoryFallback) {
          entries.forEach(([key, value]) => {
            inMemoryStore.set(key, value);
          });
        }
      });
    },

    clear: (): Future<Result<void, DOMException>> => {
      return retry(() =>
        getObjectStore("readwrite").flatMapOk((store) => {
          store.clear();
          return futurifyTransaction("clear", store.transaction);
        }),
      ).tapOk(() => {
        if (allowInMemoryFallback) {
          inMemoryStore.clear();
        }
      });
    },
  };
};
