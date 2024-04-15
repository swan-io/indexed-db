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

      if (result.isOk()) {
        for (const [key, value] of result.get()) {
          store.set(key, value);
        }
      }

      return store;
    })
    .tap((store) => {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") {
          return;
        }

        getStoreEntries(config)
          .tapError(onDatabaseError)
          .tapOk((entries) => {
            const keys = new Set(entries.map(([key]) => key));

            for (const key of store.keys()) {
              if (!keys.has(key)) {
                store.delete(key);
              }
            }

            for (const [key, value] of entries) {
              store.set(key, value);
            }
          });
      });
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
          .map(() => undefined); // Ignore the result
      }),

    clear: (): Future<void> =>
      storeFuture.flatMap((store) => {
        return clearStore(config)
          .tapOk(() => store.clear())
          .tapError(onDatabaseError)
          .map(() => undefined); // Ignore the result
      }),
  };
};
