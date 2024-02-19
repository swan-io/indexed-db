import { Future, Result } from "@swan-io/boxed";
import { createError, rewriteError } from "./errors";

export const futurifyOpen = (
  request: IDBOpenDBRequest,
  storeName: string,
): Future<Result<IDBDatabase, Error>> =>
  Future.make((resolve) => {
    const transaction = request.transaction;

    const timeoutId = setTimeout(() => {
      if (transaction == null) {
        resolve(
          Result.Error(
            createError(
              "TimeoutError",
              "openDatabase IndexedDB request timed out",
            ),
          ),
        );
      } else {
        // Throws if the transaction has already been committed or aborted.
        // Triggers onerror listener with an AbortError DOMException.
        Result.fromExecution<void, Error>(() => {
          transaction.abort();
        }).tapError((error) => {
          resolve(Result.Error(error));
        });
      }
    }, 1000);

    request.onblocked = (event) => {
      clearTimeout(timeoutId);

      resolve(
        Result.Error(
          new Error(
            `Blocked version change from ${event.oldVersion} to ${event.newVersion}`,
          ),
        ),
      );
    };

    request.onupgradeneeded = () => {
      Result.fromExecution<IDBObjectStore, Error>(() =>
        request.result.createObjectStore(storeName),
      ).tapError((error) => {
        clearTimeout(timeoutId);
        resolve(Result.Error(error));
      });
    };

    request.onsuccess = () => {
      clearTimeout(timeoutId);
      resolve(Result.Ok(request.result));
    };

    request.onerror = () => {
      clearTimeout(timeoutId);
      resolve(Result.Error(rewriteError(request.error)));
    };
  });

export const futurify = <T>(
  request: IDBRequest<T>,
  operationName: string,
  timeout: number,
): Future<Result<T, Error>> =>
  Future.make((resolve) => {
    const transaction = request.transaction;

    const timeoutId = setTimeout(() => {
      if (transaction == null) {
        resolve(
          Result.Error(
            createError(
              "TimeoutError",
              `${operationName} IndexedDB request timed out`,
            ),
          ),
        );
      } else {
        // Throws if the transaction has already been committed or aborted.
        // Triggers onerror listener with an AbortError DOMException.
        Result.fromExecution<void, Error>(() => {
          transaction.abort();
        }).tapError((error) => {
          resolve(Result.Error(error));
        });
      }
    }, timeout);

    request.onsuccess = () => {
      clearTimeout(timeoutId);
      resolve(Result.Ok(request.result));
    };

    request.onerror = () => {
      clearTimeout(timeoutId);
      resolve(Result.Error(rewriteError(request.error)));
    };
  });
