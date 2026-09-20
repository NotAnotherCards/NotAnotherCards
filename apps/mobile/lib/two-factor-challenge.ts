import {
  createContext,
  createElement,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';

type TwoFactorRedirect = {
  twoFactorRedirect: true;
};

export type TwoFactorChallengeState = {
  pending: boolean;
  hydrated: boolean;
};

const PENDING_CHALLENGE_KEY = 'notanothercards.pending-two-factor';
const UNHYDRATED_STATE: TwoFactorChallengeState = {
  pending: false,
  hydrated: false,
};
let state: TwoFactorChallengeState = UNHYDRATED_STATE;
let mutationVersion = 0;
let hydration: Promise<TwoFactorChallengeState> | null = null;
const listeners = new Set<() => void>();

const TwoFactorDeepLinkContext = createContext(false);

function publish(next: TwoFactorChallengeState) {
  if (state.pending === next.pending && state.hydrated === next.hydrated) {
    return;
  }
  state = next;
  listeners.forEach((listener) => listener());
}

function persistPendingChallenge() {
  return SecureStore.setItemAsync(PENDING_CHALLENGE_KEY, 'true').catch(() => {
    // The in-memory gate still protects this process. A storage failure only
    // means a killed process cannot resume the challenge automatically.
  });
}

function removePendingChallenge() {
  return SecureStore.deleteItemAsync(PENDING_CHALLENGE_KEY).catch(() => {
    // A stale marker returns to the challenge after a restart. Terminal-cookie
    // handling then clears it again and returns the user to login safely.
  });
}

export function isTwoFactorRedirect(data: unknown): data is TwoFactorRedirect {
  return (
    typeof data === 'object' &&
    data !== null &&
    'twoFactorRedirect' in data &&
    data.twoFactorRedirect === true
  );
}

export function isTwoFactorRequiredParam(value: unknown): boolean {
  if (Array.isArray(value)) return value.includes('true');
  return value === true || value === 'true';
}

export function beginTwoFactorChallenge() {
  mutationVersion += 1;
  publish({ pending: true, hydrated: true });
  return persistPendingChallenge();
}

export function finishTwoFactorChallenge() {
  mutationVersion += 1;
  publish({ pending: false, hydrated: true });
  return removePendingChallenge();
}

export function hydrateTwoFactorChallenge(): Promise<TwoFactorChallengeState> {
  if (state.hydrated) return Promise.resolve(state);
  if (hydration) return hydration;

  const versionAtStart = mutationVersion;
  hydration = SecureStore.getItemAsync(PENDING_CHALLENGE_KEY)
    .then((stored) => {
      if (mutationVersion === versionAtStart) {
        publish({ pending: stored === 'true', hydrated: true });
      } else if (!state.hydrated) {
        publish({ ...state, hydrated: true });
      }
      return state;
    })
    .catch(() => {
      if (!state.hydrated) publish({ ...state, hydrated: true });
      return state;
    })
    .finally(() => {
      hydration = null;
    });
  return hydration;
}

export function getTwoFactorChallengeState(): TwoFactorChallengeState {
  return state;
}

export function useTwoFactorChallengeState(): TwoFactorChallengeState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getTwoFactorChallengeState,
    () => UNHYDRATED_STATE,
  );
}

export function TwoFactorDeepLinkProvider({
  pending,
  children,
}: {
  pending: boolean;
  children: ReactNode;
}) {
  return createElement(
    TwoFactorDeepLinkContext.Provider,
    { value: pending },
    children,
  );
}

export function useTwoFactorDeepLinkPending(): boolean {
  return useContext(TwoFactorDeepLinkContext);
}

export function twoFactorChallengeError(error: unknown): string {
  const code = twoFactorChallengeErrorCode(error);

  if (code === 'ACCOUNT_TEMPORARILY_LOCKED') {
    return 'Too many failed attempts. Your account is temporarily locked. Sign in again later.';
  }
  if (code === 'INVALID_BACKUP_CODE') {
    return 'That backup code is invalid or has already been used.';
  }
  if (code === 'INVALID_CODE') {
    return 'That authentication code is invalid or has expired.';
  }
  if (code === 'INVALID_TWO_FACTOR_COOKIE') {
    return 'This verification request has expired. Sign in again.';
  }
  return 'Verification failed. Check the code and try again.';
}

export function isTerminalTwoFactorChallengeError(error: unknown): boolean {
  const code = twoFactorChallengeErrorCode(error);
  return (
    code === 'INVALID_TWO_FACTOR_COOKIE' ||
    code === 'ACCOUNT_TEMPORARILY_LOCKED'
  );
}

function twoFactorChallengeErrorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : '';
}
