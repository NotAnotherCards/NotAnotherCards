// In-memory stand-in for expo-sqlite/kv-store: jest has no native sqlite.
const store = new Map<string, string>();

export default {
  getItemSync: (key: string) => store.get(key) ?? null,
  setItemSync: (key: string, value: string) => {
    store.set(key, value);
  },
};
