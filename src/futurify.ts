import { Future, Result } from "@swan-io/boxed";
import { rewriteError } from "./errors";

export const futurifyRequest = <T>(
  operationName: string,
  request: IDBRequest<T>,
): Future<Result<T, Error>> =>
  Future.make((resolve) => {
    const transaction = request.transaction;
    let aborted = false;
    let timeoutId: NodeJS.Timeout | undefined;

    const abort = () => {
      if (!aborted) {
        aborted = true;
        transaction?.abort();
      }
    };

    request.onsuccess = () => {
      clearTimeout(timeoutId);
      resolve(Result.Ok(request.result));
    };
    request.onerror = () => {
      clearTimeout(timeoutId);
      resolve(Result.Error(rewriteError(request.error)));
    };

    if (transaction != null) {
      timeoutId = setTimeout(abort, 200);

      transaction.onabort = () => {
        clearTimeout(timeoutId);
        const message = `IndexedDB ${operationName} call timed out`;
        resolve(Result.Error(new Error(message)));
      };
    }

    return abort;
  });

export const futurifyTransaction = (
  operationName: string,
  transaction: IDBTransaction,
): Future<Result<void, Error>> =>
  Future.make((resolve) => {
    let aborted = false;

    const abort = () => {
      if (!aborted) {
        aborted = true;
        transaction.abort();
      }
    };

    const timeoutId = setTimeout(abort, 200);

    transaction.oncomplete = () => {
      clearTimeout(timeoutId);
      resolve(Result.Ok(void 0));
    };
    transaction.onerror = () => {
      clearTimeout(timeoutId);
      resolve(Result.Error(rewriteError(transaction.error)));
    };
    transaction.onabort = () => {
      clearTimeout(timeoutId);
      const message = `IndexedDB ${operationName} call timed out`;
      resolve(Result.Error(new Error(message)));
    };

    return abort;
  });
