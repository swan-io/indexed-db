const databases: Record<string, Record<string, Map<string, unknown>>> = {};

export const getInMemoryStore = (
  databaseName: string,
  storeName: string,
): Map<string, unknown> => {
  const currentDatabase = databases[databaseName];

  if (currentDatabase == null) {
    const store = new Map<string, unknown>();
    databases[databaseName] = { [storeName]: store };
    return store;
  }

  const currentStore = currentDatabase[storeName];

  if (currentStore == null) {
    const store = new Map<string, unknown>();
    currentDatabase[storeName] = store;
    return store;
  }

  return currentStore;
};
