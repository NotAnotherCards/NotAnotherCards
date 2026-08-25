/**
 * The controller's machine is tested upstream in @remelondb/core; what
 * lives here is the browser glue: which events wake it up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserSyncTriggers } from '../offline/syncController';

afterEach(() => vi.restoreAllMocks());

describe('browserSyncTriggers', () => {
  it('fires on online and on becoming visible, and unsubscribes both', () => {
    const fire = vi.fn();
    const unsubscribe = browserSyncTriggers(fire);

    window.dispatchEvent(new Event('online'));
    expect(fire).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(fire).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(fire).toHaveBeenCalledTimes(2);

    unsubscribe();
    window.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(fire).toHaveBeenCalledTimes(2);
  });
});
