import { Future, Result } from "@swan-io/boxed";

export type RetryConfig = {
  maxAttempts?: number;
  onFailedAttempt?: () => void;
};

export const retry = <A, E>(
  getFuture: () => Future<Result<A, E>>,
  { maxAttempts = 3, onFailedAttempt }: RetryConfig = {},
): Future<Result<A, E>> => {
  const safeMaxAttempts = Math.max(maxAttempts, 1);

  return getFuture().flatMapError((error) => {
    if (safeMaxAttempts <= 1) {
      return Future.value(Result.Error(error));
    }

    onFailedAttempt?.();

    return retry(getFuture, {
      maxAttempts: safeMaxAttempts - 1,
      onFailedAttempt,
    });
  });
};
