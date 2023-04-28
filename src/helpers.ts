export const zip = <T extends string>(keys: T[], values: unknown[]) =>
  keys
    .slice(0, Math.min(keys.length, values.length))
    .reduce((acc, key, index) => {
      acc[key] = values[index];
      return acc;
    }, {} as Record<T, unknown>);
