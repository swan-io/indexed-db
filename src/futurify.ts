import { Future, Result } from "@swan-io/boxed";
import { createError, rewriteError } from "./errors";

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
          if (request.readyState !== "done") {
            transaction.abort();
          }
        }).tapError((error) => resolve(Result.Error(error)));
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
