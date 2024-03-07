import { Dict, Future } from "@swan-io/boxed";
import { clearStore, getStoreEntries, setStoreEntries } from "./wrappers";

export const openStore = (databaseName: string, storeName: string) => {
  // const databaseFuture = openDatabase(databaseName, storeName);

  const future: Future<Map<string, unknown>> = getStoreEntries(
    databaseName,
    storeName,
  ).map((result) => {
    const store = new Map<string, unknown>();

    if (result.isError()) {
      // error, wipe storage?
      return store;
    }

    const entries = result.get();

    for (const [key, value] of entries) {
      if (typeof key === "string") {
        store.set(key, value);
      }
    }

    // window.addEventListener("storage", (event) => {
    //   getEntries(databaseName, storeName).tapOk((entries) => {
    //     console.log(event);
    //     console.log(entries);

    //     // const keys = entries.map(([key]) => key);

    //     // for (const key of inMemoryStore.keys()) {
    //     //   if (!keys.includes(key)) {
    //     //     inMemoryStore.delete(key);
    //     //   }
    //     // }
    //   });
    // });

    return store;
  });

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

        return setStoreEntries(databaseName, storeName, entries);
      });
    },

    clear: (): Future<void> => {
      return future.flatMap((store) => {
        store.clear();

        return clearStore(databaseName, storeName);
      });
    },
  };
};
