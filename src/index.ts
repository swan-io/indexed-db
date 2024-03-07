import { Dict, Future, Result } from "@swan-io/boxed";
import { futurify } from "./futurify";
import { Config, getEntries, request } from "./wrappers";

export const openStore = (config: Config) => {
  const future: Future<Map<string, unknown>> = getEntries(config).map(
    (result) => {
      const store = new Map<string, unknown>();

      if (result.isError()) {
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
              futurify(config, store.put(value, key)),
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
          futurify(config, store.clear()),
        )
          .tapOk(() => store.clear())
          .tapError((_error) => {}) // TODO: log potential error
          .map(() => undefined);
      });
    },
  };
};
