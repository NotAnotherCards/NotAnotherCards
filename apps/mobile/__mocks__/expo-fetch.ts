// expo/fetch wraps a native module; under jest the global fetch (mocked per
// test) stands in for it.
export const fetch: typeof globalThis.fetch = (...args) =>
  globalThis.fetch(...args);
