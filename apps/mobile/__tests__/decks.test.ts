import { act, renderHook } from '@testing-library/react-native';
import { useDecks } from '@/lib/decks';

// The due count is the only clock-dependent part of useDecks; the queries
// are stubbed with one deck holding one card.
const NOW = Date.UTC(2026, 8, 27, 12, 0);
const mockData: Record<string, unknown[]> = {
  decks: [{ id: 'd1' }],
  memberships: [{ deck_id: 'd1', note_id: 'n1' }],
  cards: [{ id: 'c1', note_id: 'n1', due_at: NOW + 30_000 }],
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
  getPersonalDictionaryQuery: () => 'cards',
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
});
