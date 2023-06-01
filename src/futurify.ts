import { Future, Result } from "@swan-io/boxed";
import { rewriteError } from "./errors";

export const futurify = <T>(
  request: IDBRequest<T>,
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
      timeoutId = setTimeout(() => {
        if (request.readyState !== "done") {
          try {
            // Triggers onerror listener with an AbortError DOMException.
            // Throw if the transaction has already been committed or aborted.
            transaction.abort();
          } catch {} // eslint-disable-line
        }
      }, timeout);
    }
  });
