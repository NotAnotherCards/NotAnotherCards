import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Stack, router, useNavigation } from 'expo-router';
import {
  act,
  fireEvent,
  renderRouter,
  waitFor,
} from 'expo-router/testing-library';
import Login from '@/app/login';
import Register from '@/app/register';

type Session = {
  data: {
    user: {
      id: string;
      onBoardingComplete: boolean;
      twoFactorEnabled: boolean;
    };
  } | null;
};
let mockSession: Session = { data: null };
const mockListeners = new Set<() => void>();
const mockSubscribe = (listener: () => void) => {
  mockListeners.add(listener);
  return () => {
    mockListeners.delete(listener);
  };
};
const mockGetSession = () => mockSession;
const mockChallenge = { hydrated: true, pending: false };
jest.mock('../lib/auth-client', () => ({
  authClient: {
    useSession: () => {
      const { useSyncExternalStore } = require('react');
      return useSyncExternalStore(
        mockSubscribe,
        mockGetSession,
        mockGetSession,
      );
    },
  },
}));
jest.mock('../lib/two-factor-challenge', () => ({
  useTwoFactorChallengeState: () => mockChallenge,
  useTwoFactorDeepLinkPending: () => false,
}));
jest.mock('../components/auth/auth-card', () => ({
  AuthCard: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../components/auth/login-form', () => ({ LoginForm: () => null }));
jest.mock('../components/auth/signup-form', () => ({ SignupForm: () => null }));

const mockDashboardMounted = jest.fn();
function DashboardProbe() {
  const [tab, setTab] = useState('overview');
  useEffect(() => {
    mockDashboardMounted();
  }, []);
  return <Text onPress={() => setTab('backup codes')}>{tab}</Text>;
}
async function updateSession(enabled: boolean) {
  await act(async () => {
    mockSession = {
      data: {
        user: {
          id: 'same-user',
          onBoardingComplete: true,
          twoFactorEnabled: enabled,
        },
      },
    };
    mockListeners.forEach((listener) => listener());
  });
}
beforeEach(() => {
  mockSession = { data: null };
  mockDashboardMounted.mockClear();
});

// Diagnostic control only: remove the underlying Login while it is unfocused.
// Production should focus-gate its redirect, not remove the whole screen.
function FocusedLogin() {
  const navigation = useNavigation();
  const [focused, setFocused] = useState(navigation.isFocused());
  useEffect(() => {
    const focus = navigation.addListener('focus', () => setFocused(true));
    const blur = navigation.addListener('blur', () => setFocused(false));
    return () => {
      focus();
      blur();
    };
  }, [navigation]);
  return focused ? <Login /> : null;
}

it.each([
  ['original Login', Login],
  ['focus-gated Login control', FocusedLogin],
])(
  'keeps the dashboard mounted after registration with %s',
  async (_name, LoginRoute) => {
    const view = renderRouter(
      {
        _layout: () => <Stack />,
        login: LoginRoute,
        register: Register,
        dashboard: DashboardProbe,
      },
      { initialUrl: '/login' },
    );
    await act(async () => {
      router.push('/register');
    });
    await updateSession(false);
    await waitFor(() => expect(view.getPathname()).toBe('/dashboard'));
    expect(JSON.stringify(view.getRouterState())).toContain('"name":"login"');
    fireEvent.press(view.getByText('overview'));
    expect(view.getByText('backup codes')).toBeTruthy();
    const mountsBefore = mockDashboardMounted.mock.calls.length;
    await updateSession(true);
    // Enabling 2FA changes the same user's session, not the selected screen.
    expect(mockDashboardMounted).toHaveBeenCalledTimes(mountsBefore);
    expect(view.getByText('backup codes')).toBeTruthy();
  },
);

it('keeps the dashboard mounted after direct login without an underlying auth screen', async () => {
  const view = renderRouter(
    { _layout: () => <Stack />, login: Login, dashboard: DashboardProbe },
    { initialUrl: '/login' },
  );
  await updateSession(false);
  await waitFor(() => expect(view.getPathname()).toBe('/dashboard'));
  const mountsBefore = mockDashboardMounted.mock.calls.length;
  await updateSession(true);
  expect(mockDashboardMounted).toHaveBeenCalledTimes(mountsBefore);
});
