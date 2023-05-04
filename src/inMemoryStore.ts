const databases: Record<string, Record<string, Map<string, unknown>>> = {};

export const getInMemoryStore = (
  databaseName: string,
  storeName: string,
): Map<string, unknown> => {
  const existingDatabase = databases[databaseName];

  if (existingDatabase == null) {
    const store = new Map<string, unknown>();
    databases[databaseName] = { [storeName]: store };
    return store;
  }

  const existingStore = existingDatabase[storeName];

  if (existingStore == null) {
    const store = new Map<string, unknown>();
    existingDatabase[storeName] = store;
    return store;
  }

  return existingStore;
};
