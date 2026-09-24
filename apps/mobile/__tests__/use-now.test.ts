import { act, renderHook } from '@testing-library/react-native';
import { useNow } from '@/lib/use-now';

describe('useNow', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // One minute before midnight UTC
    jest.setSystemTime(Date.UTC(2026, 8, 24, 23, 59));
  });
  afterEach(() => jest.useRealTimers());

  it('moves on by itself, so the Overview crosses midnight', () => {
    const { result } = renderHook(() => useNow());
    expect(new Date(result.current).getUTCDate()).toBe(24);

    act(() => jest.advanceTimersByTime(60_000));
    expect(new Date(result.current).getUTCDate()).toBe(25);
  });

  it('stops ticking once unmounted', () => {
    const { unmount } = renderHook(() => useNow());
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
