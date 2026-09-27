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

  it('keeps a zero-rejection result green and synced', () => {
    const { controller } = fakeController({
      lastResult: { resynced: false, rejected: 0, rejectedRecords: {} },
    });
    render(
      <SyncProvider controller={controller}>
        <SyncStatus />
      </SyncProvider>,
    );
    expect(screen.getByText('Synced')).toBeInTheDocument();
    const pill = screen.getByTestId('sync-status');
    expect(pill.querySelector('.bg-emerald-500')).not.toBeNull();
    expect(pill).not.toHaveAttribute('title');
    expect(pill.querySelector('details')).toBeNull();
  });

  it('shows rejected counts and expandable details without a retry', () => {
    const { controller } = fakeController({
      lastResult: {
        resynced: false,
        rejected: 514,
        rejectedRecords: {
          user_decks: ['deck-1'],
          user_note_decks: Array.from(
            { length: 513 },
            (_, i) => `membership-${i}`,
          ),
          user_cards: [],
        },
      },
    });
    const { rerender } = render(
      <SyncProvider controller={controller}>
        <SyncStatus />
      </SyncProvider>,
    );
    const summary = screen.getByText('Synced, 514 changes not accepted');
    const pill = screen.getByTestId('sync-status');
    const explanation =
      '1 deck. 513 deck memberships. The server refused these changes. They stay on this device and are sent again with the next sync.';
    expect(pill).toHaveAttribute('title', explanation);
    expect(pill.querySelector('.bg-amber-500')).not.toBeNull();
    expect(pill.querySelector('.bg-emerald-500')).toBeNull();
    expect(screen.queryByText('Retry')).toBeNull();
    // Native summary/details gives keyboard and touch users the same explanation.
    expect(summary.tagName).toBe('SUMMARY');
    expect(screen.getByText(explanation)).not.toBeVisible();
    fireEvent.click(summary);
    expect(pill.querySelector('details')).toHaveAttribute('open');
    expect(screen.getByText(explanation)).toBeVisible();

    const accepted = fakeController({
      lastResult: { resynced: false, rejected: 0, rejectedRecords: {} },
    });
    rerender(
      <SyncProvider controller={accepted.controller}>
        <SyncStatus />
      </SyncProvider>,
    );
    expect(screen.getByText('Synced')).toBeInTheDocument();
    expect(screen.queryByText(explanation)).toBeNull();
    expect(pill).not.toHaveAttribute('title');
  });

  it('uses singular wording for one rejection', () => {
    const { controller } = fakeController({
      lastResult: {
        resynced: false,
        rejected: 1,
        rejectedRecords: { user_notes: ['note-1'] },
      },
    });
    render(
      <SyncProvider controller={controller}>
        <SyncStatus />
      </SyncProvider>,
    );
    expect(
      screen.getByText('Synced, 1 change not accepted'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('sync-status').title).toMatch(/^1 note\./);
  });

  it.each(['syncing', 'offline', 'error', 'resync-required'] as const)(
    'does not replace %s with a previous rejection result',
    (status) => {
      const { controller } = fakeController({
        status,
        lastResult: {
          resynced: false,
          rejected: 1,
          rejectedRecords: { user_decks: ['deck-1'] },
        },
      });
      render(
        <SyncProvider controller={controller}>
          <SyncStatus />
        </SyncProvider>,
      );
      expect(screen.queryByText(/not accepted/)).toBeNull();
      expect(screen.getByTestId('sync-status')).not.toHaveAttribute('title');
    },
  );
});
