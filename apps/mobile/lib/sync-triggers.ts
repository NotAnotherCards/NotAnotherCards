import { AppState } from 'react-native';
import * as Network from 'expo-network';

// Native wake-ups for the shared sync controller: connectivity returning
// and the app coming to the foreground. The counterpart of the web's
// online/visibilitychange listeners.
export function nativeSyncTriggers(fire: () => void): () => void {
  // The listener repeats an unchanged state too: every 3 seconds on the
  // emulator, and on a phone at each Wi-Fi/mobile hand-over. Only a step to
  // online is news. The first report counts as one: Android promises no
  // offline report at start, so an app started offline may first hear of
  // the network when it is back, after the controller's first sync failed.
  let connected: boolean | undefined;
  const network = Network.addNetworkStateListener(({ isConnected }) => {
    const wasConnected = connected;
    connected = isConnected ?? undefined;
    if (isConnected && wasConnected !== true) fire();
  });
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') fire();
  });
  return () => {
    network.remove();
    appState.remove();
  };
}
