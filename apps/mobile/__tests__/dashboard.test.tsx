import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import Dashboard from '@/app/dashboard';

const mockUseSession = jest.fn();
const mockSignOut = jest.fn();
const mockReplace = jest.fn();

jest.mock('../lib/auth-client', () => ({
  authClient: {
    useSession: () => mockUseSession(),
    signOut: (...args: unknown[]) => mockSignOut(...args),
  },
}));

// The deck list has its own tests; keep this one about the session guard.
jest.mock('../components/deck-list', () => ({ DeckList: () => null }));
jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    useRouter: () => ({ replace: mockReplace }),
    Redirect: ({ href }: { href: string }) =>
      React.createElement(Text, null, `redirect:${href}`),
  };
});

describe('Dashboard screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignOut.mockResolvedValue(undefined);
  });

  it('redirects to login when there is no session', () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false });
    const { getByText } = render(<Dashboard />);
    expect(getByText('redirect:/login')).toBeTruthy();
  });

  it('shows the user when authenticated', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          onBoardingComplete: true,
        },
      },
      isPending: false,
    });
    const { getByText } = render(<Dashboard />);
    expect(getByText('Jane Doe')).toBeTruthy();
    expect(getByText(/jane@example.com/)).toBeTruthy();
  });

  it('offers a retry instead of redirecting when the session fetch fails', () => {
    const mockRefetch = jest.fn();
    mockUseSession.mockReturnValue({
      data: null,
      isPending: false,
      error: new Error(
        'fetch failed: java.net.ConnectException: Failed to connect to /10.0.2.2:3000',
      ),
      refetch: mockRefetch,
    });
    const { getByText, queryByText } = render(<Dashboard />);
    expect(getByText(/Can't reach the server/)).toBeTruthy();
    expect(queryByText('redirect:/login')).toBeNull();
    fireEvent.press(getByText('Retry'));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('signs out and returns to login', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'user-a',
          name: 'Jane Doe',
          email: 'jane@example.com',
          onBoardingComplete: true,
        },
      },
      isPending: false,
    });

    const { getByText } = render(<Dashboard />);
    fireEvent.press(getByText('Log out'));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('redirects to onboarding when the profile is unfinished', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          onBoardingComplete: false,
        },
      },
      isPending: false,
    });
    const { getByText } = render(<Dashboard />);
    expect(getByText('redirect:/onboarding')).toBeTruthy();
  });
});
