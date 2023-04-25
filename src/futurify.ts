import { Future, Result } from "@swan-io/boxed";
import { rewriteError } from "./errors";

export const futurifyRequest = <T>(
  name: string,
  request: IDBRequest<T>,
): Future<Result<T, Error>> =>
  Future.make((resolve) => {
    const timeoutId = setTimeout(() => {
      const error = new Error(`IndexedDB ${name} request timed out`);
      resolve(Result.Error(error));
    }, 200);

    request.onsuccess = () => {
      clearTimeout(timeoutId);
      resolve(Result.Ok(request.result));
    };
    request.onerror = () => {
      clearTimeout(timeoutId);
      resolve(Result.Error(rewriteError(request.error)));
    };
  });

export const futurifyTransaction = (
  name: string,
  transaction: IDBTransaction,
): Future<Result<void, Error>> =>
  Future.make((resolve) => {
    const timeoutId = setTimeout(() => {
      const error = new Error(`IndexedDB ${name} transaction timed out`);
      resolve(Result.Error(error));
    }, 200);

    transaction.oncomplete = () => {
      clearTimeout(timeoutId);
      resolve(Result.Ok(void 0));
    };
    transaction.onabort = () => {
      clearTimeout(timeoutId);
      resolve(Result.Error(rewriteError(transaction.error)));
    };
    transaction.onerror = () => {
      clearTimeout(timeoutId);
      resolve(Result.Error(rewriteError(transaction.error)));
    };
  });
