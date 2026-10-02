import React from 'react';
import { act, render, fireEvent, waitFor } from '@testing-library/react-native';
// The app's root loads the catalogs; these render the forms without it.
import '@/lib/i18n';
import Login from '@/app/login';
import { renderWithLocale } from '@/lib/test-utils/render-with-locale';
import {
  beginTwoFactorChallenge,
  finishTwoFactorChallenge,
} from '@/lib/two-factor-challenge';

const mockReplace = jest.fn();

// expo-router isn't available in the test env; stub the pieces the screen uses.
jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    useRouter: () => ({ replace: mockReplace }),
    useIsFocused: () => true,
    Link: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
  };
});

// The real auth client pulls in native modules; mock it like web does in setup.ts.
type MockSignInResult = {
  data: { twoFactorRedirect?: boolean } | null;
  error: { message?: string } | null;
};
const mockSignIn = jest.fn(
  async (_input?: unknown): Promise<MockSignInResult> => ({
    data: {},
    error: null,
  }),
);

// What useSession returns; tests mutate this to simulate the session arriving.
let mockSession: {
  data: { user: { name: string; onBoardingComplete?: boolean } } | null;
  isPending: boolean;
};

const mockSocialSignIn = jest.fn(
  async (_input: unknown): Promise<{ error: { message?: string } | null }> => ({
    error: null,
  }),
);

jest.mock('../lib/auth-client', () => ({
  authClient: {
    signIn: {
      email: (input: unknown) => mockSignIn(input),
      social: (input: unknown) => mockSocialSignIn(input),
    },
    useSession: () => mockSession,
    getCookie: () => '',
  },
}));

beforeEach(() => {
  finishTwoFactorChallenge();
  mockSession = { data: null, isPending: false };
  mockReplace.mockClear();
  mockSocialSignIn.mockClear();
});

describe('Login screen', () => {
  it('translates Spanish labels and validation without changing submitted field names', async () => {
    const screen = await renderWithLocale(<Login />, 'es');
    fireEvent.changeText(
      screen.getByPlaceholderText('nombre@ejemplo.com'),
      'invalid',
    );
    fireEvent.press(screen.getByText('Iniciar sesión'));
    expect(
      await screen.findByText(
        'Por favor, introduce un correo electrónico válido',
      ),
    ).toBeTruthy();
  });
  it('offers the language picker only before login', () => {
    const screen = render(<Login />);
    expect(screen.getByLabelText('Language')).toBeTruthy();
    mockSession = {
      data: { user: { name: 'Jane', onBoardingComplete: true } },
      isPending: false,
    };
    screen.rerender(<Login />);
    expect(screen.queryByLabelText('Language')).toBeNull();
  });
  it('navigates to the dashboard only once the session exists', async () => {
    const { getByText, getByPlaceholderText, rerender } = render(<Login />);
    fireEvent.changeText(
      getByPlaceholderText('name@example.com'),
      'jane@example.com',
    );
    fireEvent.changeText(getByPlaceholderText('Password'), 'Password123*');
    fireEvent.press(getByText('Login'));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
    await act(async () => {});

    // Login succeeded but the session store hasn't caught up yet - jumping
    // now is the race that bounces users back to /login.
    expect(mockReplace).not.toHaveBeenCalled();

    mockSession = {
      data: { user: { name: 'Jane Doe', onBoardingComplete: true } },
      isPending: false,
    };
    rerender(<Login />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/dashboard'));
  });

  it('offers a way to reset a forgotten password', () => {
    const { getByText } = render(<Login />);
    expect(getByText('Reset here!')).toBeTruthy();
  });

  it('renders the card and both fields', () => {
    const { getByText, getByPlaceholderText } = render(<Login />);
    expect(getByText('Welcome Back')).toBeTruthy();
    expect(getByPlaceholderText('name@example.com')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
  });

  it('shows a validation error for an invalid email on submit', async () => {
    const { getByText, getByPlaceholderText, findByText } = render(<Login />);
    fireEvent.changeText(
      getByPlaceholderText('name@example.com'),
      'not-an-email',
    );
    fireEvent.press(getByText('Login'));
    // The shared schema gives a key; the field shows its translation.
    expect(await findByText('Please enter a valid email address')).toBeTruthy();
  });

  it('shows a friendly message when the server is unreachable', async () => {
    mockSignIn.mockRejectedValueOnce(
      new Error(
        'fetch failed: java.net.ConnectException: Failed to connect to /10.0.2.2:3000',
      ),
    );
    const { getByText, getByPlaceholderText, findByText } = render(<Login />);
    fireEvent.changeText(
      getByPlaceholderText('name@example.com'),
      'jane@example.com',
    );
    fireEvent.changeText(getByPlaceholderText('Password'), 'Password123*');
    fireEvent.press(getByText('Login'));
    expect(await findByText(/Can't reach the server/)).toBeTruthy();
  });

  it('shows the server message on an API error', async () => {
    mockSignIn.mockResolvedValueOnce({
      data: null,
      error: { message: 'Invalid email or password' },
    });
    const { getByText, getByPlaceholderText, findByText } = render(<Login />);
    fireEvent.changeText(
      getByPlaceholderText('name@example.com'),
      'jane@example.com',
    );
    fireEvent.changeText(getByPlaceholderText('Password'), 'Password123*');
    fireEvent.press(getByText('Login'));
    expect(await findByText('Invalid email or password')).toBeTruthy();
  });

  it('routes a two-factor sign-in to verification before session navigation', async () => {
    mockSignIn.mockResolvedValueOnce({
      data: { twoFactorRedirect: true },
      error: null,
    });
    const { getByText, getByPlaceholderText } = render(<Login />);
    fireEvent.changeText(
      getByPlaceholderText('name@example.com'),
      'jane@example.com',
    );
    fireEvent.changeText(getByPlaceholderText('Password'), 'Password123*');
    fireEvent.press(getByText('Login'));

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/two-factor'),
    );
    expect(mockReplace).not.toHaveBeenCalledWith('/dashboard');
  });

  it('does not let a cached session bypass a pending challenge', async () => {
    beginTwoFactorChallenge();
    mockSession = {
      data: { user: { name: 'Previous User', onBoardingComplete: true } },
      isPending: false,
    };
    render(<Login />);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/two-factor'),
    );
    expect(mockReplace).not.toHaveBeenCalledWith('/dashboard');
  });

  it('routes to onboarding when the profile is unfinished', async () => {
    mockSession = {
      data: { user: { name: 'Jane Doe', onBoardingComplete: false } },
      isPending: false,
    };
    render(<Login />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/onboarding'),
    );
  });
  it('starts a social sign-in with the provider and in-app callbacks', async () => {
    const { getByText } = render(<Login />);
    fireEvent.press(getByText('Google'));
    await waitFor(() => expect(mockSocialSignIn).toHaveBeenCalledTimes(1));
    // relative paths: the Expo client turns them into the app's scheme URL
    expect(mockSocialSignIn).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: '/dashboard',
      errorCallbackURL: '/login',
    });
    // navigation still waits for the session, as with email
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows the message when a social sign-in fails', async () => {
    mockSocialSignIn.mockResolvedValueOnce({
      error: { message: 'Provider refused' },
    });
    const { getByText, findByText } = render(<Login />);
    fireEvent.press(getByText('Google'));
    expect(await findByText('Provider refused')).toBeTruthy();
    expect(mockSocialSignIn).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' }),
    );
  });
});
