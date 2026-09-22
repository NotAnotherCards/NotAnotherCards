import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ReviewSession } from '@/components/review-session';
import {
  clearLastReviewDeckId,
  loadLastReviewDeckId,
  saveReviewPreferences,
} from '@/lib/review-preferences';

const manager = { tag: 'manager' };
let mockManager: unknown = manager;
const mockRecord = jest.fn(() => Promise.resolve({ id: 'review-1' }));
const mockReadDueCards = jest.fn<Promise<Card[]>, []>(() =>
  Promise.resolve([]),
);
const mockReplace = jest.fn();
const mockBack = jest.fn();
type Card = {
  id: string;
  note_id: string;
  front: string;
  back: string;
  due_at: number;
  scheduled_interval_minutes: number;
};
let mockReviewState: {
  deck: { id: string; title: string } | null;
  dueCards: Card[];
  readDueCards: typeof mockReadDueCards;
  isLoading: boolean;
  error: Error | null;
  writes: { record: typeof mockRecord } | null;
};

jest.mock('../lib/database-provider', () => ({
  useSessionDatabase: () => ({ manager: mockManager }),
}));
jest.mock('../lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: { user: { id: 'user-1' } } }) },
}));
jest.mock('../lib/review', () => ({
  useReviewDeck: () => mockReviewState,
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack }),
  Stack: { Screen: () => null },
}));

beforeEach(() => {
  mockManager = manager;
  mockRecord.mockClear();
  mockReadDueCards.mockClear();
  mockReadDueCards.mockResolvedValue([]);
  mockReplace.mockClear();
  mockBack.mockClear();
  clearLastReviewDeckId('user-1');
  mockReviewState = {
    deck: { id: 'd1', title: 'Spanish' },
    dueCards: [
      {
        id: 'c1',
        note_id: 'n1',
        front: '**gato**',
        back: '`cat`',
        due_at: 1,
        scheduled_interval_minutes: 0,
      },
    ],
    readDueCards: mockReadDueCards,
    isLoading: false,
    error: null,
    writes: { record: mockRecord },
  };
  // The kv-store mock is shared across tests in this file.
  saveReviewPreferences('user-1', {
    reviewMode: 'basic',
    showNextReviewInterval: false,
  });
});

describe('ReviewSession', () => {
  it('waits for the database manager', () => {
    mockManager = null;
    expect(
      render(<ReviewSession deckId="d1" />).queryByText('gato'),
    ).toBeNull();
  });

  it('remembers an existing deck when review opens', async () => {
    const result = render(<ReviewSession deckId="d1" />);

    await result.findByText('gato');
    expect(loadLastReviewDeckId('user-1')).toBe('d1');
  });

  it('does not remember a missing deck', async () => {
    mockReviewState.deck = null;
    const result = render(<ReviewSession deckId="missing" />);

    await result.findByText('Deck not found');
    expect(loadLastReviewDeckId('user-1')).toBeNull();
  });

  it('clears the remembered deck when review is exited', async () => {
    const result = render(<ReviewSession deckId="d1" />);

    await result.findByText('gato');
    fireEvent.press(result.getByText('Exit review'));

    expect(loadLastReviewDeckId('user-1')).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('/deck/d1');
  });

  it('follows the saved review preference: four labels and the next interval', async () => {
    saveReviewPreferences('user-1', {
      reviewMode: 'extended',
      showNextReviewInterval: true,
    });
    const result = render(<ReviewSession deckId="d1" />);

    fireEvent.press(await result.findByText('Show answer'));
    expect(result.getByText('Again')).toBeTruthy();
    expect(result.getByText('Hard')).toBeTruthy();
    expect(result.getByText('Good')).toBeTruthy();
    expect(result.getByText('Easy')).toBeTruthy();
    // A new card: Again schedules 5 minutes, Good three days.
    expect(result.getByText('5 min')).toBeTruthy();
    expect(result.getByText('3 days')).toBeTruthy();
  });

  it('flips back to the question when the card is tapped again', async () => {
    const result = render(<ReviewSession deckId="d1" />);

    expect(await result.findByText('gato')).toBeTruthy();
    fireEvent.press(result.getByLabelText('Show the answer'));
    expect(result.getByText('cat')).toBeTruthy();

    fireEvent.press(result.getByLabelText('Show the question'));
    expect(result.queryByText('cat')).toBeNull();
    expect(result.getByText('gato')).toBeTruthy();
  });

  it('follows the saved review preference: four labels and the next interval', async () => {
    saveReviewPreferences('user-1', {
      reviewMode: 'extended',
      showNextReviewInterval: true,
    });
    const result = render(<ReviewSession deckId="d1" />);

    fireEvent.press(await result.findByText('Show answer'));
    expect(result.getByText('Again')).toBeTruthy();
    expect(result.getByText('Hard')).toBeTruthy();
    expect(result.getByText('Good')).toBeTruthy();
    expect(result.getByText('Easy')).toBeTruthy();
    // A new card: Again schedules 5 minutes, Good three days.
    expect(result.getByText('5 min')).toBeTruthy();
    expect(result.getByText('3 days')).toBeTruthy();
  });

  it('renders Markdown, shows the back alone after flipping, and records a rating', async () => {
    const result = render(<ReviewSession deckId="d1" />);

    expect(await result.findByText('gato')).toHaveStyle({ fontWeight: 'bold' });
    fireEvent.press(result.getByText('Show answer'));
    expect(result.queryByText('gato')).toBeNull();
    expect(result.getByText('cat')).toHaveStyle({ fontFamily: 'monospace' });

    expect(result.getByText('Forgot')).toBeTruthy();
    expect(result.getByText('Remembered')).toBeTruthy();
    expect(result.queryByText('Hard')).toBeNull();
    expect(result.queryByText('Easy')).toBeNull();

    fireEvent.press(result.getByText('Remembered'));
    await waitFor(() => expect(mockRecord).toHaveBeenCalledWith('c1', 3));
    expect(await result.findByText('Review complete')).toBeTruthy();
    expect(loadLastReviewDeckId('user-1')).toBeNull();
  });

  it('builds the next batch from a fresh read, not the opening snapshot', async () => {
    // Nothing else was due when the session started; a card synced in while
    // the learner was answering, so it belongs in the next batch.
    mockReadDueCards.mockResolvedValue([
      {
        id: 'c2',
        note_id: 'n2',
        front: 'perro',
        back: 'dog',
        due_at: 2,
        scheduled_interval_minutes: 0,
      },
    ]);
    const result = render(<ReviewSession deckId="d1" />);

    await result.findByText('gato');
    fireEvent.press(result.getByText('Show answer'));
    fireEvent.press(result.getByText('Remembered'));

    expect(await result.findByText('perro')).toBeTruthy();
    expect(result.queryByText('Review complete')).toBeNull();
  });

  it('drops a card from the opening snapshot that is gone by the next batch', async () => {
    // A sibling of the first card, so the batch rules leave it for the next
    // batch. It was deleted meanwhile, so the fresh read no longer has it.
    mockReviewState.dueCards = [
      ...mockReviewState.dueCards,
      {
        id: 'c2',
        note_id: 'n1',
        front: 'perro',
        back: 'dog',
        due_at: 2,
        scheduled_interval_minutes: 0,
      },
    ];
    const result = render(<ReviewSession deckId="d1" />);

    await result.findByText('gato');
    fireEvent.press(result.getByText('Show answer'));
    fireEvent.press(result.getByText('Remembered'));

    expect(await result.findByText('Review complete')).toBeTruthy();
    expect(result.queryByText('perro')).toBeNull();
  });

  it('shows a no-due-cards state and returns to the deck', async () => {
    mockReviewState.dueCards = [];
    const result = render(<ReviewSession deckId="d1" />);

    expect(await result.findByText('No cards due')).toBeTruthy();
    fireEvent.press(result.getByText('Back to deck'));
    expect(mockReplace).toHaveBeenCalledWith('/deck/d1');
  });

  it('keeps the answer visible so a failed rating can be retried', async () => {
    mockRecord.mockRejectedValueOnce(new Error('disk full'));
    const result = render(<ReviewSession deckId="d1" />);

    await result.findByText('gato');
    fireEvent.press(result.getByText('Show answer'));
    fireEvent.press(result.getByText('Forgot'));

    expect(await result.findByText('disk full')).toBeTruthy();
    expect(result.getByText('cat')).toBeTruthy();
    expect(result.getByText('Forgot')).toBeTruthy();
  });
});
