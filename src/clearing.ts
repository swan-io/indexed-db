const STORAGE_KEY = "idbClearableStores";

type Item = [databaseName: string, storeName: string];

const getClearableStores = (): Item[] => {
  try {
    const items: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    );

    if (!Array.isArray(items)) {
      return [];
    }

    return items.filter(
      (item): item is Item =>
        Array.isArray(item) &&
        item.length === 2 &&
        typeof item[0] === "string" &&
        typeof item[1] === "string",
    );
  } catch {
    return [];
  }
};

export const isStoreClearable = (
  databaseName: string,
  storeName: string,
): boolean =>
  getClearableStores().some(
    (item) => item[0] === databaseName && item[1] === storeName,
  );

export const addClearableStore = (
  databaseName: string,
  storeName: string,
): void => {
  const clearableStores = getClearableStores();

  if (
    clearableStores.some(
      (item) => item[0] === databaseName && item[1] === storeName,
    )
  ) {
    return;
  }

  const items: Item[] = [...clearableStores, [databaseName, storeName]];

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {} // eslint-disable-line no-empty
};

export const removeClearableStore = (
  databaseName: string,
  storeName: string,
): void => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        getClearableStores().filter(
          (item) => item[0] !== databaseName && item[1] !== storeName,
        ),
      ),
    );
  } catch {} // eslint-disable-line no-empty
};
