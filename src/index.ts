import { Dict, Future, Result } from "@swan-io/boxed";
import {
  getDeletableDatabases,
  setDatabaseAsDeletable,
  unsetDatabaseAsDeletable,
} from "./clearing";
import { getIndexedDBFactory } from "./factory";
import { futurifyRequest, futurifyTransaction } from "./futurify";
import { zip } from "./helpers";
import { retry } from "./retry";

const openDatabase = (
  databaseName: string,
  storeName: string,
): Future<Result<IDBDatabase, DOMException>> =>
  getIndexedDBFactory()
    .flatMapOk((factory) => {
      const databaseNames = getDeletableDatabases();

      if (!databaseNames.includes(databaseName)) {
        return Future.value(Result.Ok(factory));
      }

      return futurifyRequest(
        "deleteDatabase",
        factory.deleteDatabase(databaseName),
      )
        .tapOk(() => unsetDatabaseAsDeletable(databaseName))
        .map(() => Result.Ok(factory));
    })
    .flatMapOk((factory) => {
      const request = factory.open(databaseName);

      request.onupgradeneeded = () => {
        request.result.createObjectStore(storeName);
      };

      return futurifyRequest("openDatabase", request);
    });

export const openStore = (databaseName: string, storeName: string) => {
  const databaseFuture = openDatabase(databaseName, storeName);
  let useInMemoryStore = false;
  const inMemoryStore = new Map<string, unknown>();

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
        return Future.value(Result.Ok(zip(keys, values)));
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
        .mapOk((values: unknown[]) => zip(keys, values));
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
        setDatabaseAsDeletable(databaseName, storeName);
        useInMemoryStore = true;
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
          setDatabaseAsDeletable(databaseName, storeName);
          useInMemoryStore = true;
        });
    },
  };
};
