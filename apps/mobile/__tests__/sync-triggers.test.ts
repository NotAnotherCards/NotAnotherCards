type NetworkListener = (state: { isConnected: boolean }) => void;
const mockNetworkRemove = jest.fn();
let mockNetworkListener: NetworkListener = () => {};
jest.mock('expo-network', () => ({
  addNetworkStateListener: (listener: NetworkListener) => {
    mockNetworkListener = listener;
    return { remove: mockNetworkRemove };
  },
}));

import { AppState } from 'react-native';
import { nativeSyncTriggers } from '../lib/sync-triggers';

describe('nativeSyncTriggers', () => {
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
