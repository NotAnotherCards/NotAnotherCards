type NetworkListener = (state: { isConnected: boolean }) => void;
const mockNetworkRemove = jest.fn();
let mockNetworkListener: NetworkListener = () => {};
jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: false })),
  addNetworkStateListener: (listener: NetworkListener) => {
    mockNetworkListener = listener;
    return { remove: mockNetworkRemove };
  },
}));

import { AppState } from 'react-native';
import { nativeSyncTriggers } from '../lib/sync-triggers';
import * as Network from 'expo-network';
import { renderHook, act } from '@testing-library/react-native';
import { useConnected } from '../lib/connectivity';

describe('nativeSyncTriggers', () => {
  it('seeds availability without syncing, then counts the first listener report once', async () => {
    jest
      .mocked(Network.getNetworkStateAsync)
      .mockResolvedValueOnce({ isConnected: true });
    const fire = jest.fn();
    const stop = nativeSyncTriggers(fire);
    const { result, unmount } = renderHook(() => useConnected());
    await act(async () => {});
    expect(result.current).toBe(true);
    expect(fire).not.toHaveBeenCalled();
    act(() => mockNetworkListener({ isConnected: true }));
    act(() => mockNetworkListener({ isConnected: true }));
    expect(fire).toHaveBeenCalledTimes(1);
    unmount();
    stop();
  });
  it('ignores an initial read that arrives after a newer network event', async () => {
    let resolve!: (state: { isConnected: boolean }) => void;
    jest.mocked(Network.getNetworkStateAsync).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done as typeof resolve;
      }),
    );
    const fire = jest.fn();
    const stop = nativeSyncTriggers(fire);
    mockNetworkListener({ isConnected: false });
    resolve({ isConnected: true });
    await Promise.resolve();
    expect(fire).not.toHaveBeenCalled();
    stop();
  });
  it('fires on reconnect and foreground, not on repeats, disconnect or background', () => {
    const listeners: ((state: string) => void)[] = [];
    const appStateRemove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _type: string,
      listener: (state: string) => void,
    ) => {
      listeners.push(listener);
      return { remove: appStateRemove };
    }) as never);

    const fire = jest.fn();
    const unsubscribe = nativeSyncTriggers(fire);

    // The first report fires once; repeats while connected do not
    mockNetworkListener({ isConnected: true });
    mockNetworkListener({ isConnected: true });
    expect(fire).toHaveBeenCalledTimes(1);
    // Offline, then back: one sync for the reconnect
    mockNetworkListener({ isConnected: false });
    mockNetworkListener({ isConnected: true });
    mockNetworkListener({ isConnected: true });
    expect(fire).toHaveBeenCalledTimes(2);
    listeners[0]('active');
    listeners[0]('background');
    expect(fire).toHaveBeenCalledTimes(3);

    unsubscribe();
    expect(mockNetworkRemove).toHaveBeenCalled();
    expect(appStateRemove).toHaveBeenCalled();
  });

  it('syncs when an app started offline first hears the network is back', () => {
    // Android sends no offline report at start: the first one received
    // is the connection returning, after the first sync has failed.
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((() => ({ remove: jest.fn() })) as never);
    const fire = jest.fn();
    nativeSyncTriggers(fire);

    mockNetworkListener({ isConnected: true });
    expect(fire).toHaveBeenCalledTimes(1);
  });
});
