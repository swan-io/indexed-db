import { Future, Result } from "@swan-io/boxed";
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
  // All methods should fallback to inMemoryStore and fail only if the data doesn't exist in the store
  // const inMemoryStore = new Map<string, unknown>();

  const databaseFuture = retry(() => openDatabase(databaseName, storeName));

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
      ),

    setMany: (
      entries: [key: string, value: unknown][],
    ): Future<Result<undefined, Error>> =>
      retry(() =>
        getObjectStore("readwrite").flatMapOk((store) => {
          entries.forEach((entry) => store.put(entry[1], entry[0]));
          return futurifyTransaction("setMany", store.transaction);
        }),
      ),

    clear: (): Future<Result<undefined, Error>> =>
      retry(() =>
        getObjectStore("readwrite").flatMapOk((store) => {
          store.clear();
          return futurifyTransaction("clear", store.transaction);
        }),
      ),
  };
};
