import { Future, Option, Result } from "@swan-io/boxed";
import { futurifyRequest, futurifyTransaction } from "./futurify";
import { retry } from "./retry";

const openDatabase = (
  databaseName: string,
  storeName: string,
): Future<Result<IDBDatabase, Error>> => {
  const request = indexedDB.open(databaseName);

  request.onupgradeneeded = () => {
    request.result.createObjectStore(storeName);
  };

  return futurifyRequest("openDatabase", request);
};

export const openStore = (databaseName: string, storeName: string) => {
  const databaseFuture = retry(() => openDatabase(databaseName, storeName));
  const inMemoryStore = new Map<string, Option<unknown>>();

  const getObjectStore = (
    transactionMode: IDBTransactionMode,
  ): Future<Result<IDBObjectStore, Error>> =>
    databaseFuture.mapOk((database) =>
      database.transaction(storeName, transactionMode).objectStore(storeName),
    );

  return {
    getMany: (keys: string[]): Future<Result<unknown[], Error>> =>
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
        .flatMapError((error) =>
          Future.value(
            Option.all(
              keys.map((key) => inMemoryStore.get(key) ?? Option.None()),
            ).toResult(error),
          ),
        ),

    setMany: (object: Record<string, unknown>): Future<Result<void, Error>> => {
      const entries = Object.entries(object);

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

    clear: (): Future<Result<void, Error>> =>
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
