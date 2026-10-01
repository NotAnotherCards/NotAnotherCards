import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { reportConnectivity } from './connectivity';

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
  let active = true;
  let reported = false;
  const report = ({ isConnected }: Network.NetworkState) => {
    if (!active) return;
    const wasConnected = connected;
    connected = isConnected ?? undefined;
    reportConnectivity(isConnected === true);
    if (isConnected && wasConnected !== true) fire();
  };
  const network = Network.addNetworkStateListener((state) => {
    reported = true;
    report(state);
  });
  // Android may not emit an initial offline report. A late initial read must
  // not overwrite a newer connectivity event.
  void Network.getNetworkStateAsync()
    .then((state) => {
      // start() already runs sync. Seed UI availability only; the first
      // listener report still counts as a trigger, as before.
      if (active && !reported) reportConnectivity(state.isConnected === true);
    })
    .catch(() => {});
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') fire();
  });
  return () => {
    active = false;
    reportConnectivity(false);
    network.remove();
    appState.remove();
  };
}
