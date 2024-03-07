import { Future, Result } from "@swan-io/boxed";
import { createError, rewriteError } from "./errors";

export const futurify = <T>(
  request: IDBRequest<T>,
  operationName: string,
  timeout: number,
): Future<Result<T, Error>> =>
  Future.make((resolve) => {
    const timeoutId = setTimeout(() => {
      const transaction = request.transaction;

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
        Result.fromExecution<void, Error>(() => {
          if (request.readyState !== "done") {
            transaction.abort();
          }
        })
          .tapOk(() => {
            resolve(
              Result.Error(
                createError(
                  "TimeoutError",
                  `${operationName} IndexedDB request timed out`,
                ),
              ),
            );
          })
          .tapError((error) => {
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
