import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
} from '@testing-library/react';
import { useNavigate } from '@tanstack/react-router';
import {
  getLastReviewDeckId,
  saveLastReviewDeckId,
} from '@/lib/review-preferences';
import { Component, type ReactNode } from 'react';
import { Overview } from '../components/dashboard/Overview';
import { Progress } from '../components/ui/progress';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { authClient } from '@/lib/auth-client';
import * as syncProvider from '@/offline/syncProvider';
import * as useStoreModule from '@/hooks/useStore';
import * as dbReact from '@remelondb/core/react';

// Mock router
vi.mock('@tanstack/react-router', () => ({
  useNavigate: vi.fn(() => vi.fn()),
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

  it.each([
    {
      name: 'opens the remembered due deck',
      remembered: 'd2',
      dueDecks: ['d1', 'd2'],
      expected: 'd2',
    },
    {
      name: 'opens the only due deck without a remembered deck',
      remembered: null,
      dueDecks: ['d1'],
      expected: 'd1',
    },
    {
      name: 'skips a remembered deck with nothing due',
      remembered: 'finished',
      dueDecks: ['d1'],
      expected: 'd1',
    },
    {
      name: 'opens the library when the deck is unclear',
      remembered: 'deleted',
      dueDecks: ['d1', 'd2'],
      expected: 'library',
    },
    {
      name: 'disables review when nothing is due',
      remembered: 'finished',
      dueDecks: [],
      expected: 'nothing-due',
    },
  ])('$name', async ({ remembered, dueDecks, expected }) => {
    if (remembered) saveLastReviewDeckId(mockSession.user.id, remembered);
    const navigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);
    const store = useStoreModule.useStore();
    const cards = [...dueDecks, 'finished'].map((deckId) => ({
      id: `card-${deckId}`,
      note_id: `note-${deckId}`,
      template_key: 'basic:front-back',
      active: true,
      front: 'front',
      back: 'back',
      due_at: Date.now() + (deckId === 'finished' ? 60_000 : -1),
      scheduled_interval_minutes: 0,
      created_at: 1,
      updated_at: 1,
    }));
    vi.mocked(useStoreModule.useStore).mockReturnValue({
      ...store,
      cards,
      noteDecks: [...dueDecks, 'finished'].map((deckId) => ({
        id: `membership-${deckId}`,
        deck_id: deckId,
        note_id: `note-${deckId}`,
        active: true,
        created_at: 1,
        updated_at: 1,
      })),
    });
    const onChooseDeck = vi.fn();
    render(<Overview onChooseDeck={onChooseDeck} />);
    const button = screen.getByRole('button', { name: 'Start Review' });
    expect(button).toHaveTextContent(/^Start Review$/);
    if (expected === 'nothing-due') expect(button).toBeDisabled();
    else expect(button).toBeEnabled();
    await act(async () => {
      fireEvent.click(button);
    });
    if (expected === 'library') {
      expect(onChooseDeck).toHaveBeenCalledOnce();
      expect(navigate).not.toHaveBeenCalled();
    } else if (expected === 'nothing-due') {
      expect(onChooseDeck).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    } else {
      expect(navigate).toHaveBeenCalledWith({
        to: '/deck-review',
        search: { deckId: expected },
      });
      expect(onChooseDeck).not.toHaveBeenCalled();
    }
    expect(getLastReviewDeckId(mockSession.user.id)).toBe(remembered);
  });

  it('shows rejected changes in the sync badge', async () => {
    vi.spyOn(syncProvider, 'useSyncController').mockReturnValue({
      syncNow: vi.fn(),
    } as unknown as ReturnType<typeof syncProvider.useSyncController>);
    vi.spyOn(syncProvider, 'useSyncState').mockReturnValue({
      status: 'idle',
      lastSyncAt: 0,
      error: null,
      lastResult: {
        rejected: 3,
        rejectedRecords: { user_decks: ['d1'], user_note_decks: ['m1', 'm2'] },
      },
    } as unknown as ReturnType<typeof syncProvider.useSyncState>);

    render(<Overview onChooseDeck={() => {}} />);

    const badge = await screen.findByText('Synced, 3 not accepted');
    expect(badge).toHaveAttribute(
      'title',
      expect.stringContaining('1 deck. 2 deck memberships.'),
    );
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

  it('records a completion delivered after wall-clock midnight but before the local tick under the local activity date', async () => {
    vi.setSystemTime(new Date('2026-09-17T23:59:30Z'));
    const storageKey = 'gamification_notified_today_user-123';

    // The initial request hangs; it resolves only after wall-clock midnight.
    let resolveLate!: (value: unknown) => void;
    mockFetch.mockImplementation(
      () => new Promise((resolve) => (resolveLate = resolve)),
    );
    render(<Overview onChooseDeck={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('0 / 20')).toBeInTheDocument();
    });

    // Cross wall-clock midnight WITHOUT firing the minute tick: new Date()
    // now says 2026-09-18 while the local activity date is still 2026-09-17.
    vi.setSystemTime(new Date('2026-09-18T00:00:10Z'));
    await act(async () => {
      resolveLate({
        ok: true,
        json: async () =>
          gamificationResponse('2026-09-17', { dailyReviewCurrent: 20 }),
      });
      await Promise.resolve();
    });

    // The completion merges into the still-current local day and must be
    // recorded under the LOCAL activity date, not the wall-clock date.
    await waitFor(() => {
      expect(screen.getByText('20 / 20')).toBeInTheDocument();
    });
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(storageKey)!);
      expect(stored).toEqual({ date: '2026-09-17', codes: ['daily-review'] });
    });

    // After the tick rolls the local date over, a genuine new-day completion
    // must not be suppressed by the entry written above.
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        gamificationResponse('2026-09-18', { dailyReviewCurrent: 20 }),
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(storageKey)!);
      expect(stored).toEqual({ date: '2026-09-18', codes: ['daily-review'] });
    });
    expect(
      screen.getByText(/Challenge Completed:\s*Daily Review/),
    ).toBeInTheDocument();
  });

  it('does not merge or record a stale yesterday-dated response after the local date rolls over', async () => {
    vi.setSystemTime(new Date('2026-09-17T23:59:30Z'));
    const storageKey = 'gamification_notified_today_user-123';

    // Yesterday's completion arrives normally before midnight.
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        gamificationResponse('2026-09-17', { dailyReviewCurrent: 20 }),
    });
    render(<Overview onChooseDeck={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('20 / 20')).toBeInTheDocument();
    });
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(storageKey)!);
      expect(stored).toEqual({ date: '2026-09-17', codes: ['daily-review'] });
    });

    // The refetch triggered by the date change hangs until we resolve it.
    let resolveLate!: (value: unknown) => void;
    mockFetch.mockImplementation(
      () => new Promise((resolve) => (resolveLate = resolve)),
    );

    // Cross midnight; the minute tick rolls the local date to 2026-09-18.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    await waitFor(() => {
      expect(screen.getByText('0 / 20')).toBeInTheDocument();
    });

    // The stale, yesterday-dated response resolves after midnight. It must
    // not merge into today, and its code must not be recorded under the new
    // day's date (yesterday's untouched entry is fine — the effect only
    // writes on a new completion).
    await act(async () => {
      resolveLate({
        ok: true,
        json: async () =>
          gamificationResponse('2026-09-17', { dailyReviewCurrent: 20 }),
      });
      await Promise.resolve();
    });
    expect(screen.queryByText('20 / 20')).not.toBeInTheDocument();
    const afterStale = JSON.parse(localStorage.getItem(storageKey)!);
    expect(
      afterStale.date === '2026-09-18' &&
        afterStale.codes.includes('daily-review'),
    ).toBe(false);

    // A legitimate new-day completion still merges and notifies.
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        gamificationResponse('2026-09-18', { dailyReviewCurrent: 20 }),
    });
    vi.spyOn(syncProvider, 'useSyncState').mockReturnValue({
      status: 'idle',
      lastSyncAt: Date.now(),
      error: null,
    } as unknown as ReturnType<typeof syncProvider.useSyncState>);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    await waitFor(() => {
      expect(screen.getByText('20 / 20')).toBeInTheDocument();
    });
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(storageKey)!);
      expect(stored.date).toBe('2026-09-18');
      expect(stored.codes).toContain('daily-review');
    });
    expect(
      screen.getByText(/Challenge Completed:\s*Daily Review/),
    ).toBeInTheDocument();
  });

  it('renders the dashboard when localStorage reads throw', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        gamificationResponse('2026-09-17', { dailyReviewCurrent: 20 }),
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    render(<Overview onChooseDeck={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('20 / 20')).toBeInTheDocument();
    });
  });

  it('renders the dashboard when the localStorage write fails', async () => {
    // An unguarded write throws inside the effect commit, which surfaces as
    // an error-boundary crash rather than a test-scoped exception — so wrap
    // the tree in a boundary and assert it never triggers.
    class EffectErrorBoundary extends Component<
      { children: ReactNode },
      { crashed: boolean }
    > {
      state = { crashed: false };
      static getDerivedStateFromError() {
        return { crashed: true };
      }
      render() {
        return this.state.crashed ? (
          <div data-testid="effect-crash" />
        ) : (
          this.props.children
        );
      }
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        gamificationResponse('2026-09-17', { dailyReviewCurrent: 20 }),
    });
    // Reads succeed (empty storage); only the write throws.
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      });

    render(
      <EffectErrorBoundary>
        <Overview onChooseDeck={() => {}} />
      </EffectErrorBoundary>,
    );
    await waitFor(() => {
      expect(screen.getByText('20 / 20')).toBeInTheDocument();
    });
    // The write must actually be attempted for this test to guard anything.
    await waitFor(() => {
      expect(setItemSpy).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('effect-crash')).toBeNull();
  });

  // The fetch effect must not clear serverProgress before the refetch
  // resolves, so a completed challenge doesn't regress to local-only progress.
  it('keeps the last valid server progress while a post-sync refetch is pending', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        gamificationResponse('2026-09-17', { dailyReviewCurrent: 20 }),
    });
    const { rerender } = render(<Overview onChooseDeck={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('20 / 20')).toBeInTheDocument();
    });

    // A sync completes; the triggered refetch never resolves.
    mockFetch.mockImplementation(() => new Promise(() => {}));
    vi.spyOn(syncProvider, 'useSyncState').mockReturnValue({
      status: 'idle',
      lastSyncAt: Date.now(),
      error: null,
    } as unknown as ReturnType<typeof syncProvider.useSyncState>);
    act(() => {
      rerender(<Overview onChooseDeck={() => {}} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    // The completed state must not regress while the request is in flight.
    expect(screen.getByText('20 / 20')).toBeInTheDocument();
    expect(screen.queryByText('0 / 20')).not.toBeInTheDocument();
  });

  // Progress must forward `value` to Radix Root, so the rendered progressbar
  // is not indeterminate and exposes its value to assistive tech.
  it('exposes a determinate progressbar value to assistive tech', () => {
    const { container } = render(
      <Progress value={100} aria-label="Daily Review progress" />,
    );
    const bar = container.querySelector('[role="progressbar"]')!;
    expect(bar).toBeTruthy();
    expect(bar.getAttribute('aria-valuenow')).toBe('100');
    expect(bar.getAttribute('data-state')).toBe('complete');
  });

  describe('Gamification Badges', () => {
    it('renders all three badges in locked state when no badges are earned', async () => {
      render(<Overview onChooseDeck={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText('First Step')).toBeInTheDocument();
        expect(screen.getByText('Week Warrior')).toBeInTheDocument();
        expect(screen.getByText('Century Mark')).toBeInTheDocument();
      });

      const lockedLabels = screen.getAllByText('Locked');
      expect(lockedLabels).toHaveLength(3);

      expect(
        screen.getByText('Complete your first review'),
      ).toBeInTheDocument();
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
});
