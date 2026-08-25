import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { SyncController, SyncControllerState } from './syncController';

const SyncContext = createContext<SyncController | null>(null);

export function SyncProvider(props: {
  controller: SyncController | null;
  children?: ReactNode;
}) {
  return (
    <SyncContext.Provider value={props.controller}>
      {props.children}
    </SyncContext.Provider>
  );
}

/** The active user's sync controller; null outside an authed session. */
export function useSyncController(): SyncController | null {
  return useContext(SyncContext);
}

const NO_SYNC: SyncControllerState = {
  status: 'idle',
  lastSyncAt: null,
  error: null,
};

export function useSyncState(): SyncControllerState {
  const controller = useContext(SyncContext);
  return useSyncExternalStore(
    (onStoreChange) =>
      controller ? controller.subscribe(onStoreChange) : () => {},
    () => (controller ? controller.state : NO_SYNC),
    () => NO_SYNC,
  );
}
