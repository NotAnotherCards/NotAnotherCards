import { AppState } from 'react-native';
import * as Network from 'expo-network';

// Native wake-ups for the shared sync controller: connectivity returning
// and the app coming to the foreground. The counterpart of the web's
// online/visibilitychange listeners.
export function nativeSyncTriggers(fire: () => void): () => void {
  const network = Network.addNetworkStateListener(({ isConnected }) => {
    if (isConnected) fire();
  });
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') fire();
  });
  return () => {
    network.remove();
    appState.remove();
  };
}
