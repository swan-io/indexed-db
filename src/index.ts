import { Dict, Future, Option, Result } from "@swan-io/boxed";
import { futurifyRequest, futurifyTransaction } from "./futurify";
import { retry } from "./retry";
import { indexedDBReady } from "./safari";

const openDatabase = (
  databaseName: string,
  storeName: string,
): Future<Result<IDBDatabase, DOMException>> =>
  indexedDBReady().flatMapOk(() => {
    const request = indexedDB.open(databaseName);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName);
    };

    return futurifyRequest("openDatabase", request);
  });

export const openStore = (databaseName: string, storeName: string) => {
  const databaseFuture = openDatabase(databaseName, storeName);
  const inMemoryStore = new Map<string, Option<unknown>>();

  const getObjectStore = (
    transactionMode: IDBTransactionMode,
  ): Future<Result<IDBObjectStore, DOMException>> =>
    databaseFuture.mapOk((database) =>
      database.transaction(storeName, transactionMode).objectStore(storeName),
    );

  return {
    getMany: <T extends string>(
      keys: T[],
    ): Future<Result<Record<T, unknown>, DOMException>> =>
      retry(() =>
        getObjectStore("readonly").flatMapOk((store) =>
          futurifyRequest("getMany", store.getAll(keys)),
        ),
      )
        .tapOk((values) => {
          keys.forEach((key, index) => {
            inMemoryStore.set(key, Option.Some(values[index]));
          });
        })
        .mapErrorToResult((error) =>
          Option.all(
            keys.map((key) => inMemoryStore.get(key) ?? Option.None()),
          ).toResult(error),
        )
        .mapOk((values) =>
          keys.reduce((object, key, index) => {
            object[key] = values[index] as unknown;
            return object;
          }, {} as Record<T, unknown>),
        ),

    setMany: (
      object: Record<string, unknown>,
    ): Future<Result<void, DOMException>> => {
      const entries = Dict.entries(object);

      entries.forEach(([key, value]) => {
        inMemoryStore.set(key, Option.Some(value));
      });

      return retry(() =>
        getObjectStore("readwrite").flatMapOk((store) => {
          entries.forEach(([key, value]) => store.put(value, key));
          return futurifyTransaction("setMany", store.transaction);
        }),
      );
    },

    clear: (): Future<Result<void, DOMException>> =>
      retry(() =>
        getObjectStore("readwrite").flatMapOk((store) => {
          store.clear();
          return futurifyTransaction("clear", store.transaction);
        }),
      ).tapOk(() => {
        inMemoryStore.clear();
      }),
  };
};
