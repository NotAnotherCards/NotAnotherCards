const PENDING_CHALLENGE_KEY = 'notanothercards.pending-two-factor';

type PendingChallenge = {
  returnTo: string;
};

export function safeReturnTo(
  candidate: string | null | undefined,
  fallback = '/dashboard',
): string {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return fallback;
  }

  try {
    const url = new URL(candidate, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;

    url.searchParams.delete('twoFactorRequired');
    const path = `${url.pathname}${url.search}${url.hash}`;
    if (url.pathname === '/login' || url.pathname === '/two-factor') {
      return fallback;
    }
    return path;
  } catch {
    return fallback;
  }
}

export function rememberPendingChallenge(returnTo: string): void {
  try {
    const value: PendingChallenge = { returnTo: safeReturnTo(returnTo) };
    window.sessionStorage.setItem(PENDING_CHALLENGE_KEY, JSON.stringify(value));
  } catch {
    // Storage may be unavailable in hardened/private browser contexts. The
    // challenge remains usable through its URL query parameter.
  }
}

export function pendingChallengeReturnTo(): string | null {
  try {
    const stored = window.sessionStorage.getItem(PENDING_CHALLENGE_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('returnTo' in parsed) ||
      typeof parsed.returnTo !== 'string'
    ) {
      return null;
    }
    return safeReturnTo(parsed.returnTo);
  } catch {
    return null;
  }
}

export function clearPendingChallenge(): void {
  try {
    window.sessionStorage.removeItem(PENDING_CHALLENGE_KEY);
  } catch {
    // Nothing else needs cleaning up when session storage is unavailable.
  }
}

export function isTwoFactorRedirect(
  data: unknown,
): data is { twoFactorRedirect: true } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'twoFactorRedirect' in data &&
    data.twoFactorRedirect === true
  );
}
