import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import Dashboard from '@/app/dashboard';
import Storage from 'expo-sqlite/kv-store';
import { lastReviewDeckStorageKey } from '@repo/offline-db';
import {
  loadLastReviewDeckId,
  saveLastReviewDeckId,
} from '@/lib/review-preferences';

const mockUseSession = jest.fn();
const mockPush = jest.fn();
const mockManager = { tag: 'manager' };
const mockUseReviewOverview = jest.fn(
  (..._args: unknown[]) => mockReviewOverview,
);
let mockReviewOverview = {
  target: 'nothing-due' as string,
  dueCount: 0,
  isLoading: false,
  error: null as Error | null,
};

jest.mock('../lib/auth-client', () => ({
  authClient: { useSession: () => mockUseSession() },
}));
jest.mock('../lib/database-provider', () => ({
  useSessionDatabase: () => ({ manager: mockManager }),
}));
jest.mock('../lib/review', () => ({
  useReviewOverview: (...args: unknown[]) => mockUseReviewOverview(...args),
}));

// The deck list and settings have their own tests; keep this one about the
// session guard and the tab strip. Each tab renders a marker instead.
jest.mock('../components/deck-list', () => {
  const { Text } = require('react-native');
  return { DeckList: () => <Text>deck-list</Text> };
});
jest.mock('../components/settings', () => {
  const { Text } = require('react-native');
  return { Settings: () => <Text>settings-tab</Text> };
});
// No SafeAreaProvider in tests; the strip only reads the top inset.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../components/ui/icon', () => ({
  BookOpenIcon: () => null,
  LibraryIcon: () => null,
  SettingsIcon: () => null,
}));
jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Redirect: ({ href }: { href: string }) =>
      React.createElement(Text, null, `redirect:${href}`),
    useRouter: () => ({ push: mockPush }),
  };
});

describe('Dashboard screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Storage.removeItemSync(lastReviewDeckStorageKey('user-dashboard'));
    mockReviewOverview = {
      target: 'nothing-due',
      dueCount: 0,
      isLoading: false,
      error: null,
    };
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
          id: 'user-dashboard',
          name: 'Jane Doe',
          email: 'jane@example.com',
          onBoardingComplete: true,
        },
      },
      isPending: false,
    });
    const { getByText, queryByText } = render(<Dashboard />);
    expect(getByText('Jane Doe')).toBeTruthy();
    expect(queryByText(/jane@example.com/)).toBeNull();
  });

  it('opens on Overview and switches to the library and settings tabs', () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Jane Doe', onBoardingComplete: true } },
      isPending: false,
    });
    const { getByText, queryByText, rerender } = render(<Dashboard />);
    expect(getByText('Jane Doe')).toBeTruthy();
    expect(queryByText('deck-list')).toBeNull();

    fireEvent.press(getByText('My Library'));
    expect(getByText('deck-list')).toBeTruthy();
    expect(queryByText('Jane Doe')).toBeNull();

    // A parent re-render (session refetch, theme change) keeps the tab.
    rerender(<Dashboard />);
    expect(getByText('deck-list')).toBeTruthy();

    fireEvent.press(getByText('Profile & Settings'));
    expect(getByText('settings-tab')).toBeTruthy();
    expect(queryByText('deck-list')).toBeNull();
  });

  it('shows the due count and starts the saved deck review', () => {
    mockReviewOverview = {
      target: 'deck-spanish',
      dueCount: 3,
      isLoading: false,
      error: null,
    };
    saveLastReviewDeckId('user-dashboard', 'deck-spanish');
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'user-dashboard',
          name: 'Jane Doe',
          onBoardingComplete: true,
        },
      },
      isPending: false,
    });

    const { getByText } = render(<Dashboard />);
    expect(getByText('3 cards due')).toBeTruthy();
    fireEvent.press(getByText('Start Review'));

    expect(mockPush).toHaveBeenCalledWith('/review/deck-spanish');
    expect(mockUseReviewOverview).toHaveBeenCalledWith(
      mockManager,
      'deck-spanish',
    );
  });

  it('opens the library when the deck to review is unclear', () => {
    mockReviewOverview = {
      target: 'library',
      dueCount: 3,
      isLoading: false,
      error: null,
    };
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'user-dashboard',
          name: 'Jane Doe',
          onBoardingComplete: true,
        },
      },
      isPending: false,
    });

    const { getByText } = render(<Dashboard />);
    fireEvent.press(getByText('Start Review'));

    expect(getByText('deck-list')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('disables Start Review when nothing is due', () => {
    saveLastReviewDeckId('user-dashboard', 'deck-spanish');
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'user-dashboard',
          name: 'Jane Doe',
          onBoardingComplete: true,
        },
      },
      isPending: false,
    });

    const { getByRole, getByText } = render(<Dashboard />);
    expect(getByText('0 cards due')).toBeTruthy();
    const button = getByRole('button', { name: 'Start Review' });
    expect(button.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(button);

    expect(mockPush).not.toHaveBeenCalled();
    // Nothing due now does not forget the deck: it can be due again later.
    expect(loadLastReviewDeckId('user-dashboard')).toBe('deck-spanish');
  });

  it('does not clear the saved deck while queries are loading', () => {
    mockReviewOverview.isLoading = true;
    saveLastReviewDeckId('user-dashboard', 'deck-spanish');
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'user-dashboard',
          name: 'Jane Doe',
          onBoardingComplete: true,
        },
      },
      isPending: false,
    });

    const { getByRole } = render(<Dashboard />);
    const button = getByRole('button', { name: 'Start Review' });
    expect(button.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(button);

    expect(loadLastReviewDeckId('user-dashboard')).toBe('deck-spanish');
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
