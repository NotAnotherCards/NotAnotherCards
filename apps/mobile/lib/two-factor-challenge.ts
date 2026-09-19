import { useSyncExternalStore } from 'react';

type TwoFactorRedirect = {
  twoFactorRedirect: true;
};

let challengePending = false;
const listeners = new Set<() => void>();

function setChallengePending(next: boolean) {
  if (challengePending === next) return;
  challengePending = next;
  listeners.forEach((listener) => listener());
}

export function isTwoFactorRedirect(data: unknown): data is TwoFactorRedirect {
  return (
    typeof data === 'object' &&
    data !== null &&
    'twoFactorRedirect' in data &&
    data.twoFactorRedirect === true
  );
}

export function beginTwoFactorChallenge() {
  setChallengePending(true);
}

export function finishTwoFactorChallenge() {
  setChallengePending(false);
}

export function useTwoFactorChallengePending() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => challengePending,
    () => false,
  );
}

export function twoFactorChallengeError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';

  if (code === 'ACCOUNT_TEMPORARILY_LOCKED') {
    return 'Too many failed attempts. Try again later.';
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
