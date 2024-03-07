import { Future, Result } from "@swan-io/boxed";

export const retry = <A, E>(
  maxAttempts: number,
  getFuture: () => Future<Result<A, E>>,
): Future<Result<A, E>> =>
  getFuture().flatMapError((error) =>
    maxAttempts > 1
      ? retry(maxAttempts - 1, getFuture)
      : Future.value(Result.Error(error)),
  );
