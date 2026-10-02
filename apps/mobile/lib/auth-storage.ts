import * as SecureStore from 'expo-secure-store';

export const AUTH_STORAGE_PREFIX = 'notanothercards';

const AUTH_COOKIE_KEY = `${AUTH_STORAGE_PREFIX}_cookie`;
const AUTH_SESSION_CACHE_KEY = `${AUTH_STORAGE_PREFIX}_session_data`;

/**
 * Clear the persisted Expo auth state if the server cannot complete sign-out.
 * The Expo adapter clears its in-memory session when sign-out starts; this
 * fallback makes the persisted half explicit before the challenge gate opens.
 */
export async function clearLocalAuthStorage() {
  await Promise.all([
    SecureStore.setItemAsync(AUTH_COOKIE_KEY, '{}'),
    SecureStore.setItemAsync(AUTH_SESSION_CACHE_KEY, '{}'),
  ]);
}
