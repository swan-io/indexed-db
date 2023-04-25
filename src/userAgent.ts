import { Lazy } from "@swan-io/boxed";

// https://github.com/firebase/firebase-js-sdk/blob/firebase%409.20.0/packages/firestore/src/local/simple_db.ts#L241
export const iosVersion = Lazy(() => {
  const versionMatch = navigator.userAgent.match(
    /i(?:phone|pad|pod) os ([\d_]+)/i,
  )?.[1];

  return versionMatch != null
    ? Number(versionMatch.split("_").slice(0, 2).join("."))
    : -1;
});

// https://github.com/jakearchibald/safari-14-idb-fix/blob/v3.0.0/src/index.ts#L8
export const isSafari = Lazy(
  () =>
    !navigator.userAgentData &&
    /Safari\//.test(navigator.userAgent) &&
    !/Chrom(e|ium)\//.test(navigator.userAgent),
);
