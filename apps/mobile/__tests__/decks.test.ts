import { act, renderHook } from '@testing-library/react-native';
import { useDecks } from '@/lib/decks';

// The due count is the only clock-dependent part of useDecks; the queries
// are stubbed with one deck holding two notes, one of them not activated.
const NOW = Date.UTC(2026, 8, 27, 12, 0);
const mockData: Record<string, unknown[]> = {
  decks: [{ id: 'd1' }],
  memberships: [
    { deck_id: 'd1', note_id: 'n1' },
    { deck_id: 'd1', note_id: 'n2' },
  ],
  cards: [
    {
      id: 'c1',
      note_id: 'n1',
      due_at: NOW + 30_000,
      active: true,
      front: 'front',
      back: 'back',
    },
    {
      id: 'c2',
      note_id: 'n2',
      due_at: null,
      active: false,
      front: 'front',
      back: 'back',
    },
  ],
  profiles: [],
};

jest.mock('@remelondb/core/react', () => ({
  useDatabase: () => ({}),
  useQuery: (query: string) => ({
    data: mockData[query] ?? [],
    isLoading: false,
    error: null,
  }),
}));
jest.mock('@repo/offline-db', () => ({
  ...jest.requireActual('@repo/offline-db'),
  getDecksQuery: () => 'decks',
  getNoteDecksQuery: () => 'memberships',
  getAllCardsQuery: () => 'cards',
  getUserProfileQuery: () => 'profiles',
}));
jest.mock('../lib/database-provider', () => ({
  useSessionDatabase: () => ({ syncController: null }),
}));

describe('useDecks', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  it('counts a card that comes due while the list stays open', () => {
    const { result } = renderHook(() => useDecks({} as never));
    expect(result.current.dueCount('d1')).toBe(0);

    act(() => jest.advanceTimersByTime(60_000));
    expect(result.current.dueCount('d1')).toBe(1);
  });

  it('counts the notes and cards of a deck, and the active ones', () => {
    const { result } = renderHook(() => useDecks({} as never));
    expect(result.current.learning('d1')).toMatchObject({
      totalNotes: 2,
      activeNotes: 1,
      totalCards: 2,
      activeCards: 1,
      inactiveCards: 1,
    });
    expect(result.current.learning('unknown').totalCards).toBe(0);
  });
});
