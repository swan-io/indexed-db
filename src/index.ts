import { Dict, Future, Option, Result } from "@swan-io/boxed";
import { rewriteError } from "./errors";
import { futurifyRequest, futurifyTransaction } from "./futurify";
import { retry } from "./retry";
import { indexedDBReady } from "./safari";

const openDatabase = (
  databaseName: string,
  storeName: string,
): Future<Result<IDBDatabase, Error>> =>
  indexedDBReady().flatMapOk(() =>
    Future.make((resolve) => {
      const request = indexedDB.open(databaseName);

      request.onupgradeneeded = () => {
        request.result.createObjectStore(storeName);
      };
      request.onsuccess = () => {
        resolve(Result.Ok(request.result));
      };
      request.onerror = () => {
        resolve(Result.Error(rewriteError(request.error)));
      };
    }),
  );

export const openStore = (databaseName: string, storeName: string) => {
  const databaseFuture = openDatabase(databaseName, storeName);
  const inMemoryStore = new Map<string, Option<unknown>>();

  const getObjectStore = (
    transactionMode: IDBTransactionMode,
  ): Future<Result<IDBObjectStore, Error>> =>
    databaseFuture.mapOk((database) => {
      return database
        .transaction(storeName, transactionMode)
        .objectStore(storeName);
    }, false);

  return {
    getMany: <T extends string>(
      keys: T[],
    ): Future<Result<Record<T, unknown>, Error>> =>
      retry(() =>
        getObjectStore("readonly").flatMapOk((store) => {
          return futurifyRequest("getMany", store.getAll(keys));
        }, true),
      )
        .tapOk((values) => {
          keys.forEach((key, index) => {
            inMemoryStore.set(key, Option.Some(values[index]));
          });
        })
        .flatMapError((error) => {
          return Future.value(
            Option.all(
              keys.map((key) => inMemoryStore.get(key) ?? Option.None()),
            ).toResult(error),
          );
        }, true)
        .mapOk((values) => {
          return keys.reduce((object, key, index) => {
            object[key] = values[index] as unknown;
            return object;
          }, {} as Record<T, unknown>);
        }, true),

    setMany: (object: Record<string, unknown>): Future<Result<void, Error>> => {
      const entries = Dict.entries(object);

      entries.forEach(([key, value]) => {
        inMemoryStore.set(key, Option.Some(value));
      });

      return retry(() =>
        getObjectStore("readwrite").flatMapOk((store) => {
          entries.forEach(([key, value]) => store.put(value, key));
          return futurifyTransaction("setMany", store.transaction);
        }, true),
      );
    },

    clear: (): Future<Result<void, Error>> =>
      retry(() =>
        getObjectStore("readwrite").flatMapOk((store) => {
          store.clear();
          return futurifyTransaction("clear", store.transaction);
        }, true),
      ).tapOk(() => {
        inMemoryStore.clear();
      }),
  };
};
