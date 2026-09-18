import { render, screen, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Overview } from '../components/dashboard/Overview';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { authClient } from '@/lib/auth-client';
import * as syncProvider from '@/offline/syncProvider';
import * as useStoreModule from '@/hooks/useStore';
import * as dbReact from '@remelondb/core/react';

// Mock router
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
  },
}));

const mockSession = {
  session: {
    id: 'session-123',
    userId: 'user-123',
    expiresAt: new Date(Date.now() + 3600000),
    token: 'token-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  user: {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Legendary Learner',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    onBoardingComplete: true,
    timezone: null,
    twoFactorEnabled: false,
  },
};

/**
 * Build a valid /api/gamification/me response body that passes
 * gamificationMeSchema.safeParse().  Uses z.strictObject, so every
 * field must be present and no extras are allowed.
 */
function gamificationResponse(
  utcDate: string,
  overrides: {
    dailyReviewCurrent?: number;
    newVocabCurrent?: number;
  } = {},
) {
  const { dailyReviewCurrent = 0, newVocabCurrent = 0 } = overrides;
  return {
    utcDate,
    points: 0,
    reviewCount: dailyReviewCurrent,
    learnedNoteCount: newVocabCurrent,
    currentStreak: 0,
    longestStreak: 0,
    badges: [],
    todayChallenges: [
      {
        code: 'daily-review',
        current: dailyReviewCurrent,
        target: 20,
        completed: dailyReviewCurrent >= 20,
        completedAt: dailyReviewCurrent >= 20 ? Date.now() : null,
      },
      {
        code: 'new-vocabulary',
        current: newVocabCurrent,
        target: 5,
        completed: newVocabCurrent >= 5,
        completedAt: newVocabCurrent >= 5 ? Date.now() : null,
      },
    ],
  };
}

/**
 * Override useQuery so the first call per render (reviewEvents) returns []
 * and the second (userBadges) returns the supplied badge records.
 */
function mockUseQueryWithBadges(
  badges: Array<{
    id: string;
    badge_id: string;
    unlocked_at: number;
    created_at: number;
    updated_at: number;
  }>,
) {
  let callIndex = 0;
  vi.spyOn(dbReact, 'useQuery').mockImplementation(
    () =>
      ({
        data: ++callIndex % 2 === 0 ? badges : [],
      }) as unknown as ReturnType<typeof dbReact.useQuery>,
  );
}

describe('Overview Gamification', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // 2026-09-17 10:00:00 UTC
    vi.setSystemTime(new Date('2026-09-17T10:00:00Z'));

    vi.mocked(authClient.useSession).mockReturnValue({
      data: mockSession,
      isPending: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    });

    vi.spyOn(syncProvider, 'useSyncState').mockReturnValue({
      status: 'idle',
      lastSyncAt: 0,
      error: null,
    } as unknown as ReturnType<typeof syncProvider.useSyncState>);

    vi.spyOn(useStoreModule, 'useStore').mockReturnValue({
      ready: true,
      notes: [],
      decks: [],
      cards: [],
      noteDecks: [],
      dueCards: [],
      profiles: [],
      profile: null,
      getCardsCount: () => 0,
      getCardsForDeck: () => [],
      status: 'ready',
    } as unknown as ReturnType<typeof useStoreModule.useStore>);

    // Mock useQuery and useDatabase
    vi.spyOn(dbReact, 'useQuery').mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof dbReact.useQuery>);
    vi.spyOn(dbReact, 'useDatabase').mockReturnValue({
      get: () => ({
        query: () => [],
      }),
    } as unknown as ReturnType<typeof dbReact.useDatabase>);

    // Mock the global fetch
    originalFetch = globalThis.fetch;
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => gamificationResponse('2026-09-17'),
    });

    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('fetches /api/gamification/me on mount', async () => {
    render(<Overview onChooseDeck={() => {}} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/gamification/me',
        expect.objectContaining({ signal: expect.anything() }),
      );
    });
  });

  it('renders local challenge progress from empty review data', async () => {
    render(<Overview onChooseDeck={() => {}} />);

    // With empty reviewEvents/notes, local challenges show 0/20 and 0/5
    await waitFor(() => {
      expect(screen.getByText('0 / 20')).toBeInTheDocument();
      expect(screen.getByText('0 / 5')).toBeInTheDocument();
    });
  });

  it('merges completed server challenges into the display', async () => {
    // Server says daily-review is completed (20/20)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        gamificationResponse('2026-09-17', { dailyReviewCurrent: 20 }),
    });

    render(<Overview onChooseDeck={() => {}} />);

    // After server data loads: the merged progress should show 20/20
    await waitFor(() => {
      expect(screen.getByText('20 / 20')).toBeInTheDocument();
    });
  });

  it('refetches after a sync completes', async () => {
    const { rerender } = render(<Overview onChooseDeck={() => {}} />);

    // Wait for the initial fetch(es) to settle
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const callsBefore = mockFetch.mock.calls.length;

    // Simulate a sync completing by changing lastSyncAt
    vi.spyOn(syncProvider, 'useSyncState').mockReturnValue({
      status: 'idle',
      lastSyncAt: Date.now(),
      error: null,
    } as unknown as ReturnType<typeof syncProvider.useSyncState>);

    act(() => {
      rerender(<Overview onChooseDeck={() => {}} />);
    });

    await waitFor(() => {
      expect(mockFetch.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it('clears stale server progress when the UTC date changes', async () => {
    // 1. Initial state: Server responds with today's date (2026-09-17)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        gamificationResponse('2026-09-17', { dailyReviewCurrent: 20 }),
    });

    render(<Overview onChooseDeck={() => {}} />);

    // Wait for the merge to show 20/20
    await waitFor(() => {
      expect(screen.getByText('20 / 20')).toBeInTheDocument();
    });

    // 2. Advance time by 24 hours to trigger the interval update and date change
    act(() => {
      vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    });

    // 3. With a date mismatch, the server data should clear and local stays at 0/20
    await waitFor(() => {
      expect(screen.getByText('0 / 20')).toBeInTheDocument();
    });

    // Confirm server data didn't leak — there should be no 20/20
    expect(screen.queryByText('20 / 20')).not.toBeInTheDocument();
  });

  it('keys notification localStorage by user ID', async () => {
    // Server returns a completed challenge to trigger notification storage
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        gamificationResponse('2026-09-17', { dailyReviewCurrent: 20 }),
    });

    render(<Overview onChooseDeck={() => {}} />);

    // The storage key includes the user id
    const storageKey = 'gamification_notified_today_user-123';

    await waitFor(() => {
      const stored = localStorage.getItem(storageKey);
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.codes).toContain('daily-review');
    });

    // A different user should NOT have a notification key
    expect(
      localStorage.getItem('gamification_notified_today_user-456'),
    ).toBeNull();
  });

  it('renders all three badges in locked state when no badges are earned', async () => {
    render(<Overview onChooseDeck={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('First Step')).toBeInTheDocument();
      expect(screen.getByText('Week Warrior')).toBeInTheDocument();
      expect(screen.getByText('Century Mark')).toBeInTheDocument();
    });

    const lockedLabels = screen.getAllByText('Locked');
    expect(lockedLabels).toHaveLength(3);

    expect(screen.getByText('Complete your first review')).toBeInTheDocument();
    expect(screen.getByText('7-day streak')).toBeInTheDocument();
    expect(screen.getByText('100 distinct reviews')).toBeInTheDocument();
  });

  it('renders unlocked badge with unlock date and removes Locked label', async () => {
    const unlockTime = new Date('2026-09-15T10:00:00Z').getTime();
    mockUseQueryWithBadges([
      {
        id: 'badge-record-1',
        badge_id: 'first-review',
        unlocked_at: unlockTime,
        created_at: unlockTime,
        updated_at: unlockTime,
      },
    ]);

    render(<Overview onChooseDeck={() => {}} />);

    const expectedDate = new Date(unlockTime).toLocaleDateString();
    await waitFor(() => {
      expect(
        screen.getByText(`Unlocked: ${expectedDate}`),
      ).toBeInTheDocument();
    });

    // Only the 2 remaining badges should show "Locked"
    const lockedLabels = screen.getAllByText('Locked');
    expect(lockedLabels).toHaveLength(2);
  });

  it('shows badge notification toast with accessible screen reader text', async () => {
    const unlockTime = new Date('2026-09-17T09:00:00Z').getTime();
    mockUseQueryWithBadges([
      {
        id: 'badge-record-1',
        badge_id: 'first-review',
        unlocked_at: unlockTime,
        created_at: unlockTime,
        updated_at: unlockTime,
      },
    ]);

    render(<Overview onChooseDeck={() => {}} />);

    await waitFor(() => {
      expect(
        screen.getByText('Badge unlocked: First Step'),
      ).toBeInTheDocument();
    });

    // The toast should use role="status" for ARIA live announcement
    const statusElements = screen.getAllByRole('status');
    expect(
      statusElements.some((el) =>
        el.textContent?.includes('Badge unlocked: First Step'),
      ),
    ).toBe(true);
  });

  it('persists badge notification acknowledgement in localStorage', async () => {
    const unlockTime = new Date('2026-09-17T09:00:00Z').getTime();
    mockUseQueryWithBadges([
      {
        id: 'badge-record-1',
        badge_id: 'first-review',
        unlocked_at: unlockTime,
        created_at: unlockTime,
        updated_at: unlockTime,
      },
    ]);

    render(<Overview onChooseDeck={() => {}} />);

    const storageKey = 'gamification_badges_notified_user-123';

    await waitFor(() => {
      const stored = localStorage.getItem(storageKey);
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed).toContain('first-review');
    });
  });

  it('does not replay badge notification after localStorage acknowledgement', async () => {
    const unlockTime = new Date('2026-09-17T09:00:00Z').getTime();

    // Pre-acknowledge the badge in localStorage
    localStorage.setItem(
      'gamification_badges_notified_user-123',
      JSON.stringify(['first-review']),
    );

    mockUseQueryWithBadges([
      {
        id: 'badge-record-1',
        badge_id: 'first-review',
        unlocked_at: unlockTime,
        created_at: unlockTime,
        updated_at: unlockTime,
      },
    ]);

    render(<Overview onChooseDeck={() => {}} />);

    // Wait for badge grid to render
    await waitFor(() => {
      expect(screen.getByText('First Step')).toBeInTheDocument();
    });

    // The notification toast should NOT appear since it was already acknowledged
    expect(
      screen.queryByText('Badge unlocked: First Step'),
    ).not.toBeInTheDocument();
  });
});
