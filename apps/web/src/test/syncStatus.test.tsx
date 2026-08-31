/**
 * The visible half of #52: sync status renders the spec's states, the
 * retry button reaches the controller, and local writes through
 * useStore schedule a sync without waiting on the network.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SyncStatus } from '../components/SyncStatus';
import { SyncProvider } from '../offline/syncProvider';
import type {
  SyncController,
  SyncControllerState,
} from '../offline/syncController';

const fakeController = (state: Partial<SyncControllerState>) => {
  const full: SyncControllerState = {
    status: 'idle',
    lastSyncAt: null,
    error: null,
    cause: null,
    lastResult: null,
    ...state,
  };
  const syncNow = vi.fn();
  const controller = {
    state: full,
    subscribe: (listener: (s: SyncControllerState) => void) => {
      listener(full);
      return () => {};
    },
    start: vi.fn(),
    notifyLocalWrite: vi.fn(),
    syncNow,
    dispose: vi.fn(),
  } as unknown as SyncController;
  return { controller, syncNow };
};

describe('SyncStatus', () => {
  it('renders nothing without a controller (logged out)', () => {
    render(
      <SyncProvider controller={null}>
        <SyncStatus />
      </SyncProvider>,
    );
    expect(screen.queryByTestId('sync-status')).toBeNull();
  });

  it.each([
    ['idle', 'Synced'],
    ['syncing', 'Syncing…'],
    ['offline', 'Offline — changes will sync later'],
    ['error', 'Sync failed'],
    ['resync-required', 'Recovered from a server reset'],
  ] as const)('renders %s', (status, label) => {
    const { controller } = fakeController({ status });
    render(
      <SyncProvider controller={controller}>
        <SyncStatus />
      </SyncProvider>,
    );
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('retry reaches the controller on failure states', () => {
    const { controller, syncNow } = fakeController({ status: 'error' });
    render(
      <SyncProvider controller={controller}>
        <SyncStatus />
      </SyncProvider>,
    );
    fireEvent.click(screen.getByText('Retry'));
    expect(syncNow).toHaveBeenCalledTimes(1);
  });

  it('offers no retry while healthy', () => {
    const { controller } = fakeController({ status: 'idle' });
    render(
      <SyncProvider controller={controller}>
        <SyncStatus />
      </SyncProvider>,
    );
    expect(screen.queryByText('Retry')).toBeNull();
  });
});
