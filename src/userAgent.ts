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
