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

export const zipToObject = <T extends string>(keys: T[], values: unknown[]) =>
  keys.slice(0, Math.min(keys.length, values.length)).reduce(
    (acc, key, index) => {
      acc[key] = values[index];
      return acc;
    },
    {} as Record<T, unknown>,
  );
