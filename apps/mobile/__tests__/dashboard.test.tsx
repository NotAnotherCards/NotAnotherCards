import React from 'react';
import { act, render, fireEvent } from '@testing-library/react-native';
import type { ReactElement } from 'react';
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
let mockSyncController: {
  state: {
    status: string;
    lastSyncAt: null;
    error: null;
    cause: null;
    lastResult: null;
  };
  subscribe: (notify: () => void) => () => void;
  syncNow: jest.Mock;
} | null = null;
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
  useSessionDatabase: () => ({
    manager: mockManager,
    syncController: mockSyncController,
  }),
}));
jest.mock('../lib/review', () => ({
  useReviewOverview: (...args: unknown[]) => mockUseReviewOverview(...args),
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
let mockAchievements = {
  achievements: [] as {
    code: string;
    name: string;
    rule: string;
    description: string;
    unlockedAt: number | null;
  }[],
  isLoading: false,
  error: null as Error | null,
};
jest.mock('../lib/achievements', () => ({
  useAchievements: () => mockAchievements,
}));
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
  MedalIcon: () => null,
  SettingsIcon: () => null,
  SparklesIcon: () => null,
  TrophyIcon: () => null,
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
    mockOverviewStats = {
      stats: { ...NO_STATS },
      isLoading: false,
      error: null,
    };
    mockSyncController = null;
    mockAchievements = { achievements: [], isLoading: false, error: null };
  });

  it('shows the pull spinner for as long as the sync runs', () => {
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
    // As the controller does: syncNow() returns nothing, sets the state to
    // syncing before it returns, and reports the end through its state.
    const listeners = new Set<() => void>();
    const setStatus = (status: string) => {
      controller.state = { ...controller.state, status };
      listeners.forEach((notify) => notify());
    };
    const controller = {
      state: {
        status: 'idle',
        lastSyncAt: null,
        error: null,
        cause: null,
        lastResult: null,
      },
      subscribe: (notify: () => void) => {
        listeners.add(notify);
        return () => {
          listeners.delete(notify);
        };
      },
      syncNow: jest.fn(() => setStatus('syncing')),
    };
    mockSyncController = controller;
    const result = render(<Dashboard />);

    // jest-expo mocks RefreshControl away, so the control is read off the
    // ScrollView's prop.
    const refresh = () =>
      result.UNSAFE_getByProps({ keyboardShouldPersistTaps: 'handled' }).props
        .refreshControl as ReactElement<{
        refreshing: boolean;
        onRefresh: () => void;
      }>;
    expect(refresh().props.refreshing).toBe(false);

    act(() => refresh().props.onRefresh());
    expect(controller.syncNow).toHaveBeenCalledTimes(1);
    expect(refresh().props.refreshing).toBe(true);

    act(() => setStatus('idle'));
    expect(refresh().props.refreshing).toBe(false);

    // a sync that starts by itself shows no pull spinner
    act(() => setStatus('syncing'));
    expect(refresh().props.refreshing).toBe(false);
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
    fireEvent.press(getByText('Start Review · 3 due'));

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
    fireEvent.press(getByText('Start Review · 3 due'));

    expect(getByText('deck-list')).toBeTruthy();
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
    expect(getByText('1540 words')).toBeTruthy();
    expect(getByText('Learning Streak')).toBeTruthy();
    expect(getByText('1 Day')).toBeTruthy();
    expect(getByText('Words Learned')).toBeTruthy();
    expect(getByText('12')).toBeTruthy();
  });

  it("shows today's goals under the tiles, count or Completed", () => {
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

    const { getByText, queryByText, getByLabelText } = render(<Dashboard />);
    expect(getByText('Daily Learning Goals')).toBeTruthy();
    // A finished goal says so instead of its count
    expect(getByText('Completed')).toBeTruthy();
    expect(queryByText('20 / 20')).toBeNull();
    expect(getByText('2 / 5')).toBeTruthy();
    expect(
      getByLabelText('New Vocabulary progress').props.accessibilityValue,
    ).toMatchObject({ now: 40 });
  });

  it('shows the badges in a row and their details on a tap', () => {
    const { achievements } = jest.requireActual('../lib/achievements');
    mockAchievements.achievements = achievements([
      { badge_id: 'first-review', unlocked_at: Date.UTC(2026, 8, 20, 12) },
    ]);
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Jane Doe', onBoardingComplete: true } },
      isPending: false,
    });

    const { getByText, queryByText, getByLabelText } = render(<Dashboard />);
    expect(getByText('Achievements')).toBeTruthy();
    expect(getByLabelText('Century Mark, locked')).toBeTruthy();

    // The row shows the badges; a tap opens rule, story and date
    fireEvent.press(getByLabelText('First Step, unlocked'));
    expect(getByText('Complete your first review')).toBeTruthy();
    expect(getByText(/^Unlocked: /)).toBeTruthy();
    fireEvent.press(getByLabelText('Close'));
    expect(queryByText('Complete your first review')).toBeNull();

    fireEvent.press(getByLabelText('Week Warrior, locked'));
    expect(getByText('7-day streak')).toBeTruthy();
    expect(getByText('Locked')).toBeTruthy();
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
    mockReviewOverview.target = 'library';
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

  it('says Offline in plain text while no sync runs, as web does', () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Jane Doe', onBoardingComplete: true } },
      isPending: false,
    });

    const { getByText, queryByText } = render(<Dashboard />);
    expect(getByText('Offline')).toBeTruthy();
    expect(queryByText('Retry')).toBeNull();
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

    const { getByRole } = render(<Dashboard />);
    const button = getByRole('button', { name: 'Start Review · 0 due' });
    expect(button.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(button);

    expect(mockPush).not.toHaveBeenCalled();
    // Nothing due now does not forget the deck: it can be due again later.
    expect(loadLastReviewDeckId('user-dashboard')).toBe('deck-spanish');
  });

  it('starts the saved deck when it has inactive items to activate', () => {
    mockReviewOverview = {
      target: 'deck-spanish',
      dueCount: 0,
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

    const { getByRole } = render(<Dashboard />);
    const button = getByRole('button', { name: 'Start Review · 0 due' });
    expect(button.props.accessibilityState.disabled).toBe(false);
    fireEvent.press(button);
    expect(mockPush).toHaveBeenCalledWith('/review/deck-spanish');
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
