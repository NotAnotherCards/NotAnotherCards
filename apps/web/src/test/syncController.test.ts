/**
 * The sync controller (#52): one per authenticated database. Single
 * flight with trigger coalescing, debounced write triggers, online and
 * visibility and interval triggers, status transitions, 401 stopping
 * automatic retries, and dispose() as the logout hard-stop.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSyncController } from '../offline/syncController';
import { SyncTransportError } from '../offline/sync';

const flush = async () => {
  await vi.advanceTimersByTimeAsync(0);
};

describe('sync controller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const make = (
    runSync: (signal?: AbortSignal) => Promise<{ resynced: boolean }>,
  ) => {
    const run = vi.fn(runSync);
    const controller = createSyncController({
      runSync: run,
      intervalMs: 60_000,
      debounceMs: 2_000,
    });
    return { controller, run };
  };

  it('start syncs immediately: idle -> syncing -> idle with lastSyncAt', async () => {
    const { controller, run } = make(async () => ({ resynced: false }));
    const seen: string[] = [];
    controller.subscribe((state) => seen.push(state.status));
    controller.start();
    expect(controller.state.status).toBe('syncing');
    await flush();
    expect(run).toHaveBeenCalledTimes(1);
    expect(controller.state.status).toBe('idle');
    expect(controller.state.lastSyncAt).not.toBeNull();
    expect(seen).toContain('syncing');
    controller.dispose();
  });

  it('single flight: triggers during a run coalesce into one follow-up', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { controller, run } = make(async () => {
      await gate;
      return { resynced: false };
    });
    controller.start();
    controller.syncNow();
    controller.syncNow();
    controller.syncNow();
    expect(run).toHaveBeenCalledTimes(1); // still in flight
    release();
    await flush();
    await flush();
    expect(run).toHaveBeenCalledTimes(2); // exactly one coalesced rerun
    controller.dispose();
  });

  it('local writes debounce into one run', async () => {
    const { controller, run } = make(async () => ({ resynced: false }));
    controller.start();
    await flush();
    run.mockClear();
    controller.notifyLocalWrite();
    controller.notifyLocalWrite();
    await vi.advanceTimersByTimeAsync(1_000);
    controller.notifyLocalWrite();
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2_100);
    expect(run).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it('the background interval triggers runs', async () => {
    const { controller, run } = make(async () => ({ resynced: false }));
    controller.start();
    await flush();
    run.mockClear();
    await vi.advanceTimersByTimeAsync(61_000);
    expect(run).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it('coming online triggers a run', async () => {
    const { controller, run } = make(async () => ({ resynced: false }));
    controller.start();
    await flush();
    run.mockClear();
    window.dispatchEvent(new Event('online'));
    await flush();
    expect(run).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it('becoming visible triggers a run', async () => {
    const { controller, run } = make(async () => ({ resynced: false }));
    controller.start();
    await flush();
    run.mockClear();
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(run).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it('a network failure reads as offline, recovery as idle', async () => {
    let fail = true;
    const { controller } = make(async () => {
      if (fail) throw new SyncTransportError('network down');
      return { resynced: false };
    });
    controller.start();
    await flush();
    expect(controller.state.status).toBe('offline');
    fail = false;
    controller.syncNow();
    await flush();
    expect(controller.state.status).toBe('idle');
    controller.dispose();
  });

  it('a server error reads as error and keeps the message', async () => {
    const { controller } = make(async () => {
      throw new SyncTransportError('sync push: HTTP 503', 503);
    });
    controller.start();
    await flush();
    expect(controller.state.status).toBe('error');
    expect(controller.state.error).toMatch(/503/);
    controller.dispose();
  });

  it('401 blocks automatic retries until a manual retry', async () => {
    let status: number | undefined = 401;
    const { controller, run } = make(async () => {
      if (status) throw new SyncTransportError('HTTP 401', status);
      return { resynced: false };
    });
    controller.start();
    await flush();
    expect(controller.state.status).toBe('error');
    run.mockClear();

    controller.notifyLocalWrite();
    await vi.advanceTimersByTimeAsync(5_000);
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(run).not.toHaveBeenCalled(); // auth failures stop the machinery

    status = undefined;
    controller.syncNow(); // the human (or a fresh login) re-arms it
    await flush();
    expect(run).toHaveBeenCalledTimes(1);
    expect(controller.state.status).toBe('idle');
    controller.dispose();
  });

  it('a resynced run surfaces as resync-required until the next sync', async () => {
    let resynced = true;
    const { controller } = make(async () => ({ resynced }));
    controller.start();
    await flush();
    expect(controller.state.status).toBe('resync-required');
    resynced = false;
    controller.syncNow();
    await flush();
    expect(controller.state.status).toBe('idle');
    controller.dispose();
  });

  it('dispose aborts a sync that is still in flight', async () => {
    let seen: AbortSignal | undefined;
    const { controller } = make(async (signal?: AbortSignal) => {
      seen = signal;
      await new Promise(() => {}); // never settles on its own
      return { resynced: false };
    });
    controller.start();
    await flush();
    expect(seen?.aborted).toBe(false);

    controller.dispose();
    // the run's transport can stop instead of writing into a closing db
    expect(seen?.aborted).toBe(true);
  });

  it('dispose stops every trigger', async () => {
    const { controller, run } = make(async () => ({ resynced: false }));
    controller.start();
    await flush();
    run.mockClear();
    controller.notifyLocalWrite();
    controller.dispose();
    await vi.advanceTimersByTimeAsync(200_000);
    window.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange'));
    controller.syncNow();
    await flush();
    expect(run).not.toHaveBeenCalled();
  });
});
