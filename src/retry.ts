import { Future, Result } from "@swan-io/boxed";

export const retry = <A, E>(
  getFuture: () => Future<Result<A, E>>,
  maxAttempts = 5,
): Future<Result<A, E>> => {
  const safeMaxAttempts = Math.max(maxAttempts, 1);

  return getFuture().flatMapError((error) => {
    if (safeMaxAttempts === 1) {
      return Future.value(Result.Error(error));
    }

    return retry(getFuture, safeMaxAttempts - 1);
  });
};
