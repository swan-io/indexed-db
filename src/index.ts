import { Dict, Future, Result } from "@swan-io/boxed";
import {
  isStoreClearable,
  setStoreAsClearable,
  unsetStoreAsClearable,
} from "./clearing";
import { getIndexedDBFactory } from "./factory";
import { futurifyRequest, futurifyTransaction } from "./futurify";
import { zipToObject } from "./helpers";
import { retry } from "./retry";

export const openStore = (databaseName: string, storeName: string) => {
  const inMemoryStore = new Map<string, unknown>();
  let useInMemoryStore = false;

  const databaseFuture = getIndexedDBFactory()
    .flatMapOk((factory) => {
      const request = factory.open(databaseName);

      request.onupgradeneeded = () => {
        request.result.createObjectStore(storeName);
      };

      return futurifyRequest("openDatabase", request);
    })
    .flatMapOk((database) => {
      if (!isStoreClearable(databaseName, storeName)) {
        return Future.value(Result.Ok(database));
      }

      const store = database
        .transaction(storeName, "readwrite")
        .objectStore(storeName);

      store.clear();

      return futurifyTransaction("clear", store.transaction)
        .tapOk(() => unsetStoreAsClearable(databaseName, storeName))
        .tapError(() => {
          useInMemoryStore = true;
        })
        .map(() => Result.Ok(database));
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
      if (useInMemoryStore) {
        const values = keys.map((key) => inMemoryStore.get(key));
        return Future.value(Result.Ok(zipToObject(keys, values)));
      }

      return retry(() =>
        getObjectStore("readonly").flatMapOk((store) =>
          Future.all(
            keys.map((key) => futurifyRequest("getMany", store.get(key))),
          ).map((results) => Result.all(results)),
        ),
      )
        .tapOk((values: unknown[]) => {
          keys.forEach((key, index) => {
            inMemoryStore.set(key, values[index]);
          });
        })
        .mapErrorToResult(() =>
          Result.Ok<unknown[], DOMException>(
            keys.map((key) => inMemoryStore.get(key)),
          ),
        )
        .mapOk((values: unknown[]) => zipToObject(keys, values));
    },

    setMany: (
      object: Record<string, unknown>,
    ): Future<Result<undefined, DOMException>> => {
      const entries = Dict.entries(object);

      entries.forEach(([key, value]) => {
        inMemoryStore.set(key, value);
      });

      if (useInMemoryStore) {
        return Future.value(Result.Ok(undefined));
      }

      return retry(() =>
        getObjectStore("readwrite").flatMapOk((store) => {
          entries.forEach(([key, value]) => store.put(value, key));
          return futurifyTransaction("setMany", store.transaction);
        }),
      ).tapError(() => {
        useInMemoryStore = true;
        setStoreAsClearable(databaseName, storeName);
      });
    },

    clear: (): Future<Result<undefined, DOMException>> => {
      if (useInMemoryStore) {
        inMemoryStore.clear();
        return Future.value(Result.Ok(undefined));
      }

      return retry(() =>
        getObjectStore("readwrite").flatMapOk((store) => {
          store.clear();
          return futurifyTransaction("clear", store.transaction);
        }),
      )
        .tap(() => inMemoryStore.clear())
        .tapError(() => {
          useInMemoryStore = true;
          setStoreAsClearable(databaseName, storeName);
        });
    },
  };
};
