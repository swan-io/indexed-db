import { Future, Result } from "@swan-io/boxed";
import { rewriteError } from "./errors";

export const futurifyRequest = <T>(
  request: IDBRequest<T>,
  operationName: string,
  timeout: number,
): Future<Result<T, DOMException>> =>
  Future.make((resolve) => {
    request.onsuccess = () => {
      resolve(Result.Ok(request.result));
    };
    request.onerror = () => {
      resolve(Result.Error(rewriteError(request.error)));
    };

    const transaction = request.transaction;

    if (transaction != null) {
      const timeoutId = setTimeout(() => {
        transaction.abort();
      }, timeout);

      transaction.oncomplete = () => {
        clearTimeout(timeoutId);
      };
      transaction.onerror = () => {
        clearTimeout(timeoutId);
      };
      transaction.onabort = () => {
        clearTimeout(timeoutId);

        resolve(
          Result.Error(
            new DOMException(
              `${operationName} IndexedDB request timed out`,
              "TimeoutError",
            ),
          ),
        );
      };
    }
  });

export const futurifyTransaction = (
  transaction: IDBTransaction,
  operationName: string,
  timeout: number,
): Future<Result<void, DOMException>> =>
  Future.make((resolve) => {
    const timeoutId = setTimeout(() => {
      transaction.abort();
    }, timeout);

    transaction.oncomplete = () => {
      clearTimeout(timeoutId);
      resolve(Result.Ok(undefined));
    };
    transaction.onerror = () => {
      clearTimeout(timeoutId);
      resolve(Result.Error(rewriteError(transaction.error)));
    };
    transaction.onabort = () => {
      clearTimeout(timeoutId);

      resolve(
        Result.Error(
          new DOMException(
            `${operationName} IndexedDB transaction timed out`,
            "TimeoutError",
          ),
        ),
      );
    };
  });
