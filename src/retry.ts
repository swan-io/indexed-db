import { Future, Result } from "@swan-io/boxed";

class RetryAbortedError<E> extends Error {
  constructor(public originalError: E) {
    super("Attempt has been aborted");
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, RetryAbortedError.prototype);
  }
}

const resolveAfter = (ms: number): Future<void> =>
  Future.make((resolve) => {
    setTimeout(resolve, ms);
  });

export type RetryConfig = {
  maxAttempts?: number;
  delay?: number;
  onFailedAttempt?: () => Future<void> | void;
};

export const retry = <T, E>(
  getFuture: (/*abort: () => void*/) => Future<Result<T, E>>,
  { maxAttempts = 3, delay = 1000, onFailedAttempt }: RetryConfig = {},
): Future<Result<T, E>> => {
  const safeMaxAttempts = Math.max(maxAttempts, 1);

  return getFuture().flatMapError((error) => {
    if (safeMaxAttempts <= 1) {
      return Future.value(Result.Error(error));
    }

    const tmp = onFailedAttempt?.();
    const x = tmp instanceof Future ? tmp : Future.value(tmp);

    return x
      .flatMap(() => resolveAfter(delay))
      .flatMap(() =>
        retry(getFuture, {
          maxAttempts: safeMaxAttempts - 1,
          delay,
          onFailedAttempt,
        }),
      );
  });
};
