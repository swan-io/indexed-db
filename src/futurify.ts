import { Future, Result } from "@swan-io/boxed";
import { rewriteError } from "./errors";

export const futurifyRequest = <T>(
  operationName: string,
  request: IDBRequest<T>,
): Future<Result<T, DOMException>> =>
  Future.make((resolve) => {
    const transaction = request.transaction;
    let timeoutId: NodeJS.Timeout | undefined;

    request.onsuccess = () => {
      clearTimeout(timeoutId);
      resolve(Result.Ok(request.result));
    };
    request.onerror = () => {
      clearTimeout(timeoutId);
      resolve(Result.Error(rewriteError(request.error)));
    };

    if (transaction != null) {
      timeoutId = setTimeout(() => {
        transaction.abort();
      }, 300);

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
  operationName: string,
  transaction: IDBTransaction,
): Future<Result<undefined, DOMException>> =>
  Future.make((resolve) => {
    transaction.oncomplete = () => {
      clearTimeout(timeoutId);
      resolve(Result.Ok(undefined));
    };
    transaction.onerror = () => {
      clearTimeout(timeoutId);
      resolve(Result.Error(rewriteError(transaction.error)));
    };

    const timeoutId = setTimeout(() => {
      transaction.abort();
    }, 300);

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
