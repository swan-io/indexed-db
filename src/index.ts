import { Dict, Future, Option, Result } from "@swan-io/boxed";
import { rewriteError } from "./errors";
import { futurifyRequest, futurifyTransaction } from "./futurify";
import { retry } from "./retry";
import { isSafari } from "./userAgent";

const openDatabase = (
  databaseName: string,
  storeName: string,
): Future<Result<IDBDatabase, Error>> =>
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

    if (isSafari.get()) {
      /**
       * Safari has a horrible bug where IDB requests can hang forever.
       * We resolve this future with error after 200ms if it seems to happen.
       * @see https://bugs.webkit.org/show_bug.cgi?id=226547
       */
      setTimeout(() => {
        const message = `Couldn't open ${databaseName} IndexedDB database`;
        resolve(Result.Error(new Error(message)));
      }, 200);
    }
  });

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
    getMany: <T extends string>(
      keys: T[],
    ): Future<Result<Record<T, unknown>, Error>> =>
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
        )
        .mapOk((values) =>
          keys.reduce((object, key, index) => {
            object[key] = values[index] as unknown;
            return object;
          }, {} as Record<T, unknown>),
        ),

    setMany: (object: Record<string, unknown>): Future<Result<void, Error>> => {
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
