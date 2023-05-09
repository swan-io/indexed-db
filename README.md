# @swan-io/indexed-db

[![Tests](https://github.com/swan-io/indexed-db/actions/workflows/tests.yml/badge.svg)](https://github.com/swan-io/indexed-db/actions/workflows/tests.yml)
[![mit licence](https://img.shields.io/dub/l/vibe-d.svg)](https://github.com/swan-io/indexed-db/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@swan-io/indexed-db)](https://www.npmjs.org/package/@swan-io/indexed-db)
[![bundlephobia](https://img.shields.io/bundlephobia/minzip/@swan-io/indexed-db?label=size)](https://bundlephobia.com/result?p=@swan-io/indexed-db)

A resilient, [Future](https://swan-io.github.io/boxed/future)-based key-value store for IndexedDB.

## Installation

```sh
$ yarn add @swan-io/indexed-db
# --- or ---
$ npm install --save @swan-io/indexed-db
```

## Quickstart

```ts
const store = openStore("myDatabaseName", "myStoreName");

store
  .setMany({
    firstName: "Mathieu",
    lastName: "Breton",
  })
  .flatMapOk(() => store.getMany(["firstName", "lastName"]))
  .flatMapOk(({ firstName, lastName }) => {
    console.log({
      firstName,
      lastName,
    });

    return store.clear();
  })
  .tapOk(() => {
    console.log("✅");
  });
```

## API

Open a database, create a store if needed and returns methods to manipulate it.<br/>
Note that you can open multiple databases / stores, with different names.

```ts
const store = await openStore("myDatabaseName", "myStoreName", {
  enableInMemoryFallback: true, // keep data in-memory in cases of read failures (default: false)
  transactionRetries: 3, // retry failed transactions (default: 3)
  transactionTimeout: 300, // timeout a transaction when it takes too long (default: 300ms)
});
```

### store.getMany

Get many values at once. Resolves with a record.

```ts
store
  .getMany(["firstName", "lastName"])
  .mapOk(({ firstName, lastName }) => console.log({ firstName, lastName }));
```

### store.setMany

Set many key-value pairs at once.

```ts
store
  .setMany({ firstName: "Mathieu", lastName: "Breton" })
  .tapOk(() => console.log("✅"));
```

### store.clear

Clear all values in the store.

```ts
store.clear().tapOk(() => console.log("✅"));
```

## 🙌 Acknowledgements

- [firebase-js-sdk](https://github.com/firebase/firebase-js-sdk) by [@firebase](https://github.com/firebase)
- [idb-keyval](https://github.com/jakearchibald/idb-keyval) and [safari-14-idb-fix](https://github.com/jakearchibald/safari-14-idb-fix) by [@jakearchibald](https://github.com/jakearchibald)
