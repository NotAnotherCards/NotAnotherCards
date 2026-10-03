import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SocialLoginButtons } from '@/components/auth/social-login-buttons';
import { authClient } from '@/lib/auth-client';
import {
  finishTwoFactorChallenge,
  getTwoFactorChallengeState,
} from '@/lib/two-factor-challenge';

const mockReplace = jest.fn();
const mockFetch = jest.fn();
jest.mock('better-auth/react', () => {
  const { createAuthClient } = jest.requireActual('better-auth/react');
  return {
    createAuthClient: (options: Record<string, unknown>) =>
      createAuthClient({
        ...options,
        fetchOptions: {
          customFetchImpl: (...args: unknown[]) => mockFetch(...args),
        },
      }),
  };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock('../lib/api-url', () => ({ apiURL: 'https://api.example.test' }));
jest.mock('expo-linking', () => ({
  createURL: (path: string) => `notanothercards://${path.replace(/^\//, '')}`,
}));

// Native boundaries only. Use the real auth client, Expo cookie adapter, and
// social buttons; iOS returns a browser result without dispatching a deep link.
jest.mock('expo-secure-store', () => {
  const storage = new Map<string, string>();
  return {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    getItemAsync: async (key: string) => storage.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      storage.set(key, value);
    },
    deleteItemAsync: async (key: string) => {
      storage.delete(key);
    },
  };
});
const mockOpenAuthSession = jest.fn();
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: (...args: unknown[]) => mockOpenAuthSession(...args),
}));

beforeEach(async () => {
  jest.clearAllMocks();
  await finishTwoFactorChallenge();
  const storage = require('expo-secure-store');
  storage.setItem('notanothercards_cookie', '{}');
  storage.setItem('notanothercards_session_data', '{}');
  mockFetch.mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          redirect: true,
          url: 'https://provider.example.test/oauth',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
  );
});

it.each(['better-auth.two_factor', '__Secure-better-auth.two_factor'])(
  'routes the native OAuth callback to verification for %s without a Linking event',
  async (name) => {
    const callback = new URL(
      'notanothercards://dashboard?twoFactorRequired=true',
    );
    callback.searchParams.set(
      'cookie',
      `${name}=signed-challenge; Max-Age=600`,
    );
    mockOpenAuthSession.mockResolvedValue({
      type: 'success',
      url: callback.toString(),
    });
    const view = render(<SocialLoginButtons />);
    fireEvent.press(view.getByText('Google'));

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/two-factor'),
    );
    expect(mockOpenAuthSession).toHaveBeenCalled();
    expect(authClient.getCookie()).toContain(`${name}=signed-challenge`);
    expect(getTwoFactorChallengeState().pending).toBe(true);
    expect(mockReplace).not.toHaveBeenCalledWith('/dashboard');
  },
);

it('does not start a challenge after browser cancellation', async () => {
  mockOpenAuthSession.mockResolvedValue({ type: 'cancel' });
  const view = render(<SocialLoginButtons />);
  fireEvent.press(view.getByText('Google'));
  await waitFor(() => expect(mockOpenAuthSession).toHaveBeenCalled());
  await waitFor(() =>
    expect(
      view.getByRole('button', { name: 'Continue with Google' }).props
        .accessibilityState.disabled,
    ).toBe(false),
  );
  expect(mockReplace).not.toHaveBeenCalled();
  expect(getTwoFactorChallengeState().pending).toBe(false);
});

it('keeps normal OAuth session cookies and waits for session navigation', async () => {
  const callback = new URL('notanothercards://dashboard');
  callback.searchParams.set(
    'cookie',
    'better-auth.session_token=session-token; Max-Age=600',
  );
  mockOpenAuthSession.mockResolvedValue({
    type: 'success',
    url: callback.toString(),
  });
  const view = render(<SocialLoginButtons />);
  fireEvent.press(view.getByText('Google'));
  await waitFor(() =>
    expect(authClient.getCookie()).toContain(
      'better-auth.session_token=session-token',
    ),
  );
  await waitFor(() =>
    expect(
      view.getByRole('button', { name: 'Continue with Google' }).props
        .accessibilityState.disabled,
    ).toBe(false),
  );
  expect(getTwoFactorChallengeState().pending).toBe(false);
  expect(mockReplace).not.toHaveBeenCalled();
});

it('ignores an expired challenge cookie from the native callback', async () => {
  const callback = new URL('notanothercards://dashboard');
  callback.searchParams.set(
    'cookie',
    'better-auth.two_factor=expired; Max-Age=0',
  );
  mockOpenAuthSession.mockResolvedValue({
    type: 'success',
    url: callback.toString(),
  });
  const view = render(<SocialLoginButtons />);
  fireEvent.press(view.getByText('Google'));
  await waitFor(() => expect(mockOpenAuthSession).toHaveBeenCalled());
  await waitFor(() =>
    expect(
      view.getByRole('button', { name: 'Continue with Google' }).props
        .accessibilityState.disabled,
    ).toBe(false),
  );
  expect(authClient.getCookie()).toBe('');
  expect(getTwoFactorChallengeState().pending).toBe(false);
  expect(mockReplace).not.toHaveBeenCalled();
});

it('surfaces a provider error without starting a challenge', async () => {
  mockFetch.mockImplementation(
    async () =>
      new Response(
        JSON.stringify({ message: 'Provider refused', code: 'PROVIDER_ERROR' }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      ),
  );
  const view = render(<SocialLoginButtons />);
  fireEvent.press(view.getByText('Google'));
  expect(await view.findByText('An unexpected error occurred')).toBeTruthy();
  expect(mockOpenAuthSession).not.toHaveBeenCalled();
  expect(getTwoFactorChallengeState().pending).toBe(false);
  expect(mockReplace).not.toHaveBeenCalled();
});
