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
    name: 'Test User',
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
    // Server responds with yesterday's date
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        gamificationResponse('2026-09-16', { dailyReviewCurrent: 20 }),
    });

    render(<Overview onChooseDeck={() => {}} />);

    // With a date mismatch, server challenges should NOT merge:
    // local stays at 0/20 because reviewEvents is empty
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
});
