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
  getClearableStores().findIndex(
    (item) => item[0] === databaseName && item[1] === storeName,
  ) > -1;

export const setStoreAsClearable = (
  databaseName: string,
  storeName: string,
): void => {
  try {
    const items: Item[] = [...getClearableStores(), [databaseName, storeName]];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {} // eslint-disable-line no-empty
};

export const unsetStoreAsClearable = (
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
