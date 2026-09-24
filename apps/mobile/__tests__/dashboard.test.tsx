import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import Dashboard from '@/app/dashboard';
import {
  clearLastReviewDeckId,
  loadLastReviewDeckId,
  saveLastReviewDeckId,
} from '@/lib/review-preferences';

const mockUseSession = jest.fn();
const mockPush = jest.fn();
const mockManager = { tag: 'manager' };
let mockSyncController: {
  state: {
    status: string;
    lastSyncAt: null;
    error: null;
    cause: null;
    lastResult: null;
  };
  subscribe: () => () => void;
  syncNow: jest.Mock;
} | null = null;
let mockReviewOverview = {
  dueDeckIds: new Set<string>(),
  dueCount: 0,
  isLoading: false,
  error: null as Error | null,
};

jest.mock('../lib/auth-client', () => ({
  authClient: { useSession: () => mockUseSession() },
}));
jest.mock('../lib/database-provider', () => ({
  useSessionDatabase: () => ({
    manager: mockManager,
    syncController: mockSyncController,
  }),
}));
jest.mock('../lib/review', () => ({
  useReviewOverview: () => mockReviewOverview,
}));
const NO_STATS = {
  dictionarySize: 0,
  streak: 0,
  wordsLearned: 0,
  challenges: [
    { code: 'daily-review', current: 0, target: 20, completed: false },
    { code: 'new-vocabulary', current: 0, target: 5, completed: false },
  ],
};
let mockOverviewStats = {
  stats: { ...NO_STATS } as typeof NO_STATS | null,
  isLoading: false,
  error: null as Error | null,
};
// Only the hook is faked: dailyGoals is the real copy the card renders.
jest.mock('../lib/overview-stats', () => ({
  ...jest.requireActual('../lib/overview-stats'),
  useOverviewStats: () => mockOverviewStats,
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
  BookMarkedIcon: () => null,
  BookOpenIcon: () => null,
  FlameIcon: () => null,
  GraduationCapIcon: () => null,
  InfoIcon: () => null,
  LibraryIcon: () => null,
  SettingsIcon: () => null,
  SparklesIcon: () => null,
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
    clearLastReviewDeckId('user-dashboard');
    mockReviewOverview = {
      dueDeckIds: new Set(),
      dueCount: 0,
      isLoading: false,
      error: null,
    };
    mockOverviewStats = {
      stats: { ...NO_STATS },
      isLoading: false,
      error: null,
    };
    mockSyncController = null;
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
      dueDeckIds: new Set(['deck-spanish']),
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
    fireEvent.press(getByText('Start Review · 3 due'));

    expect(mockPush).toHaveBeenCalledWith('/review/deck-spanish');
  });

  it('clears a saved deck with nothing due and opens the library', () => {
    // Deleted or finished, the branch is the same: the deck is not in the
    // set of decks with due cards. 3 cards are due, all in another deck.
    mockReviewOverview = {
      dueDeckIds: new Set(['deck-french']),
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
    fireEvent.press(getByText('Start Review · 3 due'));

    expect(getByText('deck-list')).toBeTruthy();
    expect(loadLastReviewDeckId('user-dashboard')).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows web's three stat tiles on the Overview", () => {
    mockOverviewStats.stats = {
      ...NO_STATS,
      dictionarySize: 1540,
      streak: 1,
      wordsLearned: 12,
    };
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Jane Doe', onBoardingComplete: true } },
      isPending: false,
    });

    const { getByText } = render(<Dashboard />);
    expect(getByText('Personal Dictionary')).toBeTruthy();
    expect(getByText('1540 cards')).toBeTruthy();
    expect(getByText('Learning Streak')).toBeTruthy();
    expect(getByText('1 Day')).toBeTruthy();
    expect(getByText('Words Learned')).toBeTruthy();
    expect(getByText('12')).toBeTruthy();
  });

  it("shows today's goals with web's copy under the tiles", () => {
    mockOverviewStats.stats = {
      ...NO_STATS,
      challenges: [
        { code: 'daily-review', current: 20, target: 20, completed: true },
        { code: 'new-vocabulary', current: 2, target: 5, completed: false },
      ],
    };
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Jane Doe', onBoardingComplete: true } },
      isPending: false,
    });

    const { getByText, getByLabelText } = render(<Dashboard />);
    expect(getByText('Daily Learning Goals')).toBeTruthy();
    expect(getByText('20 / 20')).toBeTruthy();
    expect(getByText('Completed')).toBeTruthy();
    expect(getByText('2 / 5')).toBeTruthy();
    expect(getByText('3 remaining')).toBeTruthy();
    expect(
      getByLabelText('New Vocabulary progress').props.accessibilityValue,
    ).toMatchObject({ now: 40 });
  });

  it('opens the goal rules over the screen from the info button', () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Jane Doe', onBoardingComplete: true } },
      isPending: false,
    });

    const { getByLabelText, getByText, queryByText } = render(<Dashboard />);
    expect(queryByText(/One review earns one point/)).toBeNull();

    fireEvent.press(getByLabelText('How daily goals count'));
    expect(getByText(/One review earns one point/)).toBeTruthy();
    // A tap anywhere closes it: on the panel or beside it
    fireEvent.press(getByText(/One review earns one point/));
    expect(queryByText(/One review earns one point/)).toBeNull();

    fireEvent.press(getByLabelText('How daily goals count'));
    fireEvent.press(getByLabelText('Close'));
    expect(queryByText(/One review earns one point/)).toBeNull();
  });

  it('reports a statistics error and keeps Start Review usable', () => {
    mockOverviewStats = {
      stats: null,
      isLoading: false,
      error: new Error('Unsupported review rating: 9'),
    };
    mockReviewOverview.dueCount = 2;
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Jane Doe', onBoardingComplete: true } },
      isPending: false,
    });

    const { getByText, getByRole } = render(<Dashboard />);
    expect(
      getByText(/Could not load your statistics: Unsupported review rating: 9/),
    ).toBeTruthy();
    expect(
      getByRole('button', { name: 'Start Review · 2 due' }).props
        .accessibilityState.disabled,
    ).toBeFalsy();
  });

  it('shows the sync status next to the greeting, with a retry after a failure', () => {
    mockSyncController = {
      state: {
        status: 'error',
        lastSyncAt: null,
        error: null,
        cause: null,
        lastResult: null,
      },
      subscribe: () => () => {},
      syncNow: jest.fn(),
    };
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Jane Doe', onBoardingComplete: true } },
      isPending: false,
    });

    const { getByText } = render(<Dashboard />);
    expect(getByText('Jane Doe')).toBeTruthy();
    expect(getByText('Sync failed')).toBeTruthy();
    fireEvent.press(getByText('Retry'));
    expect(mockSyncController.syncNow).toHaveBeenCalled();
  });

  it('keeps Start Review to the Overview tab', () => {
    mockReviewOverview.dueCount = 4;
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Jane Doe', onBoardingComplete: true } },
      isPending: false,
    });

    const { getByText, queryByText } = render(<Dashboard />);
    expect(getByText('Start Review · 4 due')).toBeTruthy();
    fireEvent.press(getByText('My Library'));
    expect(queryByText(/Start Review/)).toBeNull();
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
