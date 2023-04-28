const STORAGE_KEY = "idbDeletableDatabases";

const getDeletableDatabases = (): string[] => {
  try {
    const databaseNames: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    );

    if (!Array.isArray(databaseNames)) {
      return [];
    }

    return databaseNames.filter(
      (item): item is string => typeof item === "string",
    );
  } catch {
    return [];
  }
};

export const isDatabaseDeletable = (databaseName: string) =>
  getDeletableDatabases().indexOf(databaseName) > -1;

export const setDatabaseAsDeletable = (databaseName: string) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([...getDeletableDatabases(), databaseName]),
    );
  } catch {} // eslint-disable-line no-empty
};

export const unsetDatabaseAsDeletable = (databaseName: string) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        getDeletableDatabases().filter((item) => item !== databaseName),
      ),
    );
  } catch {} // eslint-disable-line no-empty
};
