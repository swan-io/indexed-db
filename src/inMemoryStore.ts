const databases: Record<string, Record<string, Map<string, unknown>>> = {};

export const getInMemoryStore = (
  databaseName: string,
  storeName: string,
): Map<string, unknown> => {
  const currentDatabase = databases[databaseName];
  const currentStore = currentDatabase?.[storeName];
  const store = currentStore ?? new Map<string, unknown>();

  if (currentDatabase == null) {
    databases[databaseName] = { [storeName]: store };
  } else if (currentStore == null) {
    currentDatabase[storeName] = store;
  }

  return store;
};
