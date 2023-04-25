import { Future, Result } from "@swan-io/boxed";
import { rewriteError } from "./errors";

export const futurifyRequest = <T>(
  request: IDBRequest<T>,
): Future<Result<T, Error>> =>
  Future.make((resolve) => {
    request.onsuccess = () => {
      resolve(Result.Ok(request.result));
    };
    request.onerror = () => {
      resolve(Result.Error(rewriteError(request.error)));
    };
  });

export const futurifyTransaction = (
  transaction: IDBTransaction,
): Future<Result<undefined, Error>> =>
  Future.make((resolve) => {
    transaction.oncomplete = () => {
      resolve(Result.Ok(undefined));
    };
    transaction.onabort = () => {
      resolve(Result.Error(rewriteError(transaction.error)));
    };
    transaction.onerror = () => {
      resolve(Result.Error(rewriteError(transaction.error)));
    };
  });
