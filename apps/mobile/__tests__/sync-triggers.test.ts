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

    // At start and while it stays connected: the first sync covers it
    mockNetworkListener({ isConnected: true });
    mockNetworkListener({ isConnected: true });
    expect(fire).not.toHaveBeenCalled();
    // Offline, then back: one sync for the reconnect
    mockNetworkListener({ isConnected: false });
    mockNetworkListener({ isConnected: true });
    mockNetworkListener({ isConnected: true });
    expect(fire).toHaveBeenCalledTimes(1);
    listeners[0]('active');
    listeners[0]('background');
    expect(fire).toHaveBeenCalledTimes(2);

    unsubscribe();
    expect(mockNetworkRemove).toHaveBeenCalled();
    expect(appStateRemove).toHaveBeenCalled();
  });
});
