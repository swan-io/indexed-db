import { Dict, Future, Result } from "@swan-io/boxed";
import { futurify } from "./futurify";
import { retry, zipToObject } from "./helpers";
import { getInMemoryStore } from "./inMemoryStore";
import { getStore, openDatabase } from "./wrappers";

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
    transactionRetries = 2,
    transactionTimeout = 500,
  } = options;

  const databaseFuture = openDatabase(databaseName, storeName);
  const inMemoryStore = getInMemoryStore(databaseName, storeName);

  return {
    getMany: <T extends string>(
      keys: T[],
    ): Future<Result<Record<T, unknown>, Error>> => {
      return databaseFuture
        .flatMapOk((database) =>
          retry(transactionRetries, () => {
            return getStore(
              database,
              databaseName,
              storeName,
              "readonly",
            ).flatMapOk((store) =>
              Future.all(
                keys.map((key) =>
                  futurify(store.get(key), "getMany", transactionTimeout)
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
            );
          }),
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
    ): Future<Result<undefined, Error>> => {
      const entries = Dict.entries(object);

      return databaseFuture
        .flatMapOk((database) =>
          retry(transactionRetries, () => {
            return getStore(
              database,
              databaseName,
              storeName,
              "readwrite",
            ).flatMapOk((store) =>
              Future.all(
                entries.map(([key, value]) =>
                  futurify(
                    store.put(value, key),
                    "setMany",
                    transactionTimeout,
                  ),
                ),
              ).map((results) => Result.all(results)),
            );
          }),
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

    clear: (): Future<Result<undefined, Error>> => {
      return databaseFuture
        .flatMapOk((database) =>
          retry(transactionRetries, () => {
            return getStore(
              database,
              databaseName,
              storeName,
              "readwrite",
            ).flatMapOk((store) =>
              futurify(store.clear(), "clear", transactionTimeout),
            );
          }),
        )
        .tapOk(() => {
          if (enableInMemoryFallback) {
            inMemoryStore.clear();
          }
        });
    },
  };
};
