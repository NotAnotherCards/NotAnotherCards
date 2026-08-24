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
  it('fires on reconnect and foreground, not on disconnect or background', () => {
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

    mockNetworkListener({ isConnected: true });
    mockNetworkListener({ isConnected: false });
    listeners[0]('active');
    listeners[0]('background');
    expect(fire).toHaveBeenCalledTimes(2);

    unsubscribe();
    expect(mockNetworkRemove).toHaveBeenCalled();
    expect(appStateRemove).toHaveBeenCalled();
  });
});
