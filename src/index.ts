import { Dict, Future, Result } from "@swan-io/boxed";
import { futurify } from "./futurify";
import { getInMemoryStore } from "./inMemoryStore";
import { getEntries, request } from "./wrappers";

export const openStore = (
  databaseName: string,
  storeName: string,
  options: {
    transactionRetries?: number;
    transactionTimeout?: number;
  } = {},
) => {
  const { transactionRetries = 2, transactionTimeout = 500 } = options;

  const config = {
    databaseName,
    storeName,
    transactionRetries,
    transactionTimeout,
  };

  const future: Future<Map<string, unknown>> = getEntries(config).map(
    (result) => {
      const store = getInMemoryStore(databaseName, storeName);

      if (result.isError()) {
        return store;
      }

      const entries = result.get();

      for (const [key, value] of entries) {
        if (typeof key === "string") {
          store.set(key, value);
        }
      }

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          getEntries(config).tapOk((entries) => {
            const keys = entries.map(([key]) => key);

            for (const [key, value] of entries) {
              if (typeof key === "string") {
                store.set(key, value);
              }
            }

            for (const key of store.keys()) {
              if (!keys.includes(key)) {
                store.delete(key);
              }
            }
          });
        }
      });

      return store;
    },
  );

  return {
    getMany: <T extends string>(keys: T[]): Future<Record<T, unknown>> => {
      return future.map((store) =>
        keys.reduce(
          (acc, key) => {
            acc[key] = store.get(key);
            return acc;
          },
          {} as Record<T, unknown>,
        ),
      );
    },

    setMany: (object: Record<string, unknown>): Future<void> => {
      return future.flatMap((store) => {
        const entries = Dict.entries(object);

        for (const [key, value] of entries) {
          store.set(key, value);
        }

        return request(config, "readwrite", (store) =>
          Future.all(
            entries.map(([key, value]) =>
              futurify(store.put(value, key), transactionTimeout),
            ),
          ).map((results) => Result.all(results)),
        )
          .tapError((_error) => {}) // TODO: log potential error
          .map(() => undefined);
      });
    },

    clear: (): Future<void> => {
      return future.flatMap((store) => {
        return request(config, "readwrite", (store) =>
          futurify(store.clear(), transactionTimeout),
        )
          .tapOk(() => store.clear())
          .tapError((_error) => {}) // TODO: log potential error
          .map(() => undefined);
      });
    },
  };
};
