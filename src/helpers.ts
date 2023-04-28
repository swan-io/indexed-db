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

export const zipToObject = <T extends string>(keys: T[], values: unknown[]) =>
  keys
    .slice(0, Math.min(keys.length, values.length))
    .reduce((acc, key, index) => {
      acc[key] = values[index];
      return acc;
    }, {} as Record<T, unknown>);
