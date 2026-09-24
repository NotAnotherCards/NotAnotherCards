import { act, renderHook } from '@testing-library/react-native';
import type { SyncControllerState } from '@remelondb/core';
import {
  SYNCING_SHOW_DELAY_MS,
  syncStatusView,
  useSettledSyncState,
} from '@/lib/sync-status';

const state = (
  overrides: Partial<SyncControllerState> = {},
): SyncControllerState =>
  ({
    status: 'idle',
    lastSyncAt: 1,
    error: null,
    cause: null,
    lastResult: null,
    ...overrides,
  }) as SyncControllerState;

describe('syncStatusView', () => {
  it('reads Synced when idle, with nothing to retry', () => {
    expect(syncStatusView(state())).toMatchObject({
      label: 'Synced',
      tone: 'synced',
      retryable: false,
    });
  });

  it('offers a retry when offline or failed, not while syncing', () => {
    expect(syncStatusView(state({ status: 'offline' })).retryable).toBe(true);
    expect(syncStatusView(state({ status: 'error' }))).toMatchObject({
      label: 'Sync failed',
      tone: 'error',
      retryable: true,
    });
    expect(syncStatusView(state({ status: 'syncing' }))).toMatchObject({
      label: 'Syncing…',
      retryable: false,
    });
  });

  it("says how many changes the server refused, with web's wording", () => {
    const view = syncStatusView(
      state({
        lastResult: {
          rejected: 2,
          rejectedRecords: { review_events: ['r1', 'r2'] },
        } as unknown as SyncControllerState['lastResult'],
      }),
    );
    expect(view.label).toBe('Synced, 2 not accepted');
    expect(view.tone).toBe('warning');
    expect(view.details).toMatch(/^2 reviews\. The server refused/);
  });
});

const settle = (initial: SyncControllerState) =>
  renderHook(
    (props: { current: SyncControllerState }) =>
      useSettledSyncState(props.current),
    { initialProps: { current: initial } },
  );

describe('useSettledSyncState', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('keeps Synced through a short background sync', () => {
    const { result, rerender } = settle(state());

    rerender({ current: state({ status: 'syncing' }) });
    act(() => jest.advanceTimersByTime(SYNCING_SHOW_DELAY_MS - 100));
    const next = state({ lastSyncAt: 2 });
    rerender({ current: next });

    expect(result.current).toBe(next);
  });

  it('shows Syncing once a run takes longer than the delay', () => {
    const { result, rerender } = settle(state());

    rerender({ current: state({ status: 'syncing' }) });
    expect(result.current.status).toBe('idle');
    act(() => jest.advanceTimersByTime(SYNCING_SHOW_DELAY_MS));
    expect(result.current.status).toBe('syncing');
  });

  it('shows a failure at once', () => {
    const { result, rerender } = settle(state());

    rerender({ current: state({ status: 'error' }) });
    expect(result.current.status).toBe('error');
  });
});
