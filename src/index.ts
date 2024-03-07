import { Dict, Future } from "@swan-io/boxed";
import { getInMemoryStore } from "./inMemoryStore";
import { clearStore, getStoreEntries, setStoreEntries } from "./wrappers";

export const openStore = (
  databaseName: string,
  storeName: string,
  options: {
    onDatabaseError?: (error: Error) => void;
    transactionRetries?: number;
    transactionTimeout?: number;
  } = {},
) => {
  const {
    onDatabaseError = () => {},
    transactionRetries = 2,
    transactionTimeout = 500,
  } = options;

  const config = {
    databaseName,
    storeName,
    transactionRetries,
    transactionTimeout,
  };

  const storeFuture: Future<Map<string, unknown>> = getStoreEntries(config)
    .tapError(onDatabaseError)
    .map((result) => {
      const store = getInMemoryStore(databaseName, storeName);

      if (result.isError()) {
        return store;
      }

      const entries = result.get();

      for (const [key, value] of entries) {
        store.set(key, value);
      }

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          getStoreEntries(config)
            .tapError(onDatabaseError)
            .tapOk((newEntries) => {
              const newKeys = new Set(newEntries.map(([key]) => key));

              for (const existingKey of store.keys()) {
                if (!newKeys.has(existingKey)) {
                  store.delete(existingKey);
                }
              }

              for (const [newKey, newValue] of newEntries) {
                store.set(newKey, newValue);
              }
            });
        }
      });

      return store;
    });

  return {
    getMany: <T extends string>(keys: T[]): Future<Record<T, unknown>> =>
      storeFuture.map((store) =>
        keys.reduce(
          (acc, key) => {
            acc[key] = store.get(key);
            return acc;
          },
          {} as Record<T, unknown>,
        ),
      ),

    setMany: (object: Record<string, unknown>): Future<void> =>
      storeFuture.flatMap((store) => {
        const entries = Dict.entries(object);

        for (const [key, value] of entries) {
          store.set(key, value);
        }

        return setStoreEntries(config, entries)
          .tapError(onDatabaseError)
          .map(() => undefined);
      }),

    clear: (): Future<void> =>
      storeFuture.flatMap((store) =>
        clearStore(config)
          .tapOk(() => store.clear())
          .tapError(onDatabaseError)
          .map(() => undefined),
      ),
  };
};
