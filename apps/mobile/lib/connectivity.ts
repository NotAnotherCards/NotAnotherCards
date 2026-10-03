import { useSyncExternalStore } from 'react';

// Updated by sync's existing native listener, not a second network subscription.
let connected = false;
const listeners = new Set<() => void>();
export function reportConnectivity(next: boolean) {
  if (next === connected) return;
  connected = next;
  listeners.forEach((notify) => notify());
}
const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
};
export function useConnected() {
  return useSyncExternalStore(subscribe, () => connected);
}
