import { Config } from "./wrappers";

const databases: Record<string, Record<string, Map<string, unknown>>> = {};

export const getInMemoryStore = (config: Config): Map<string, unknown> => {
  const existingDatabase = databases[config.databaseName];

  if (existingDatabase == null) {
    const store = new Map<string, unknown>();
    databases[config.databaseName] = { [config.storeName]: store };
    return store;
  }

  const existingStore = existingDatabase[config.storeName];

  if (existingStore == null) {
    const store = new Map<string, unknown>();
    existingDatabase[config.storeName] = store;
    return store;
  }

  return existingStore;
};
