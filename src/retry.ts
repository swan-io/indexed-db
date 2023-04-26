import { Future, Result } from "@swan-io/boxed";

export const retry = <A, E>(
  getFuture: () => Future<Result<A, E>>,
  maxAttempts = 3,
): Future<Result<A, E>> =>
  getFuture().flatMapError((error) =>
    maxAttempts > 1
      ? retry(getFuture, maxAttempts - 1)
      : Future.value(Result.Error(error)),
  );
