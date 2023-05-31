import { Future, Result } from "@swan-io/boxed";
import { rewriteError } from "./errors";

export const futurifyRequest = <T>(
  request: IDBRequest<T>,
  operationName: string,
  timeout: number,
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
      const resolveAfterAbort = () =>
        resolve(
          Result.Error(
            new DOMException(
              `${operationName} IndexedDB request timed out`,
              "TimeoutError",
            ),
          ),
        );

      timeoutId = setTimeout(() => {
        try {
          transaction.abort();
        } catch {
          resolveAfterAbort();
        }
      }, timeout);

      transaction.onabort = () => {
        clearTimeout(timeoutId);
        resolveAfterAbort();
      };
    }
  });

export const futurifyTransaction = (
  transaction: IDBTransaction,
  operationName: string,
  timeout: number,
): Future<Result<void, DOMException>> =>
  Future.make((resolve) => {
    transaction.oncomplete = () => {
      clearTimeout(timeoutId);
      resolve(Result.Ok(undefined));
    };
    transaction.onerror = () => {
      clearTimeout(timeoutId);
      resolve(Result.Error(rewriteError(transaction.error)));
    };

    const resolveAfterAbort = () =>
      resolve(
        Result.Error(
          new DOMException(
            `${operationName} IndexedDB transaction timed out`,
            "TimeoutError",
          ),
        ),
      );

    const timeoutId = setTimeout(() => {
      try {
        transaction.abort();
      } catch {
        resolveAfterAbort();
      }
    }, timeout);

    transaction.onabort = () => {
      clearTimeout(timeoutId);
      resolveAfterAbort();
    };
  });
