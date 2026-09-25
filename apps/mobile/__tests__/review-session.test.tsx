import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ReviewSession } from '@/components/review-session';
import {
  loadReviewPreferences,
  saveReviewPreferences,
} from '@/lib/review-preferences';

const manager = { tag: 'manager' };
let mockManager: unknown = manager;
const mockRecord = jest.fn((_cardId: string, _rating: number) =>
  Promise.resolve({ id: 'review-1' }),
);
const mockCreate = jest.fn(() => Promise.resolve());
const mockUpdate = jest.fn(() => Promise.resolve());
const mockDeleteNote = jest.fn((_noteId: string) => Promise.resolve());
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockReviewState: {
  deck: { id: string; title: string; note_type: string } | null;
  dueCards: Array<{
    id: string;
    note_id: string;
    front: string;
    back: string;
    due_at: number;
    scheduled_interval_minutes: number;
  }>;
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
// The editor's data: a basic deck whose cards are all editable.
jest.mock('../lib/cards', () => ({
  useCards: () => ({
    deck: {
      id: 'd1',
      title: 'Spanish',
      note_type: 'basic',
      native_language_id: null,
      target_language_id: null,
    },
    canEdit: () => true,
    noteForCard: () => null,
    writes: {
      create: mockCreate,
      update: mockUpdate,
      deleteNote: mockDeleteNote,
    },
  }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack }),
  Stack: { Screen: () => null },
}));

beforeEach(() => {
  mockManager = manager;
  mockRecord.mockClear();
  mockCreate.mockClear();
  mockUpdate.mockClear();
  mockDeleteNote.mockClear();
  mockReplace.mockClear();
  mockBack.mockClear();
  mockReviewState = {
    deck: { id: 'd1', title: 'Spanish', note_type: 'basic' },
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
    // Each answer carries its own hue.
    expect(result.getByText('Again').props.className).toContain(
      'text-rating-again',
    );
    expect(result.getByText('Hard').props.className).toContain(
      'text-rating-hard',
    );
    expect(result.getByText('Good').props.className).toContain(
      'text-rating-good',
    );
    expect(result.getByText('Easy').props.className).toContain(
      'text-rating-easy',
    );
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

  it('counts progress across batches, not per batch', async () => {
    // A sibling of the first card waits for the next batch.
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
    // As the live query does: an answered card is no longer due.
    mockRecord.mockImplementationOnce((id) => {
      mockReviewState.dueCards = mockReviewState.dueCards.filter(
        (card) => card.id !== id,
      );
      return Promise.resolve({ id: 'review-1' });
    });
    const result = render(<ReviewSession deckId="d1" />);

    expect(await result.findByText('1 of 2')).toBeTruthy();
    fireEvent.press(result.getByText('Show answer'));
    fireEvent.press(result.getByText('Remembered'));
    expect(await result.findByText('2 of 2')).toBeTruthy();
    expect(result.getByText('perro')).toBeTruthy();
  });

  it('edits the current card and returns to it', async () => {
    const result = render(<ReviewSession deckId="d1" />);

    await result.findByText('gato');
    fireEvent.press(result.getByLabelText('Edit this card'));
    expect(result.getByText('Edit card')).toBeTruthy();
    fireEvent.changeText(result.getByPlaceholderText('The answer'), 'a cat');
    fireEvent.press(result.getByText('Save'));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith('c1', '**gato**', 'a cat'),
    );
    expect(await result.findByText('1 of 1')).toBeTruthy();
    expect(result.getByText('gato')).toBeTruthy();
  });

  it('opens the editor on a long press of the card', async () => {
    const result = render(<ReviewSession deckId="d1" />);

    await result.findByText('gato');
    fireEvent(result.getByLabelText('Show the answer'), 'longPress');
    expect(result.getByText('Edit card')).toBeTruthy();
  });

  it('adds a card to the deck without losing the place', async () => {
    const result = render(<ReviewSession deckId="d1" />);

    await result.findByText('gato');
    fireEvent.press(result.getByLabelText('Add a card'));
    fireEvent.changeText(
      result.getByPlaceholderText('The question or prompt'),
      'perro',
    );
    fireEvent.changeText(result.getByPlaceholderText('The answer'), 'dog');
    fireEvent.press(result.getByText('Save'));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith('d1', 'perro', 'dog'),
    );
    expect(await result.findByText('1 of 1')).toBeTruthy();
    expect(result.getByText('gato')).toBeTruthy();
  });

  it('steps through the answer layouts on a long press, without rating', async () => {
    const result = render(<ReviewSession deckId="d1" />);

    await result.findByText('gato');
    fireEvent.press(result.getByText('Show answer'));
    expect(result.getByText('Forgot')).toBeTruthy();

    fireEvent(result.getByText('Forgot'), 'longPress');
    expect(result.getByText('Four answers')).toBeTruthy();
    expect(result.getByText('Hard')).toBeTruthy();
    expect(result.queryByText('5 min')).toBeNull();

    fireEvent(result.getByText('Again'), 'longPress');
    expect(result.getByText('Four answers with intervals')).toBeTruthy();
    expect(result.getByText('5 min')).toBeTruthy();

    fireEvent(result.getByText('Again'), 'longPress');
    expect(result.getByText('Two answers')).toBeTruthy();
    expect(result.getByText('Remembered')).toBeTruthy();
    expect(result.queryByText('5 min')).toBeNull();

    expect(mockRecord).not.toHaveBeenCalled();
    expect(loadReviewPreferences('user-1')).toEqual({
      reviewMode: 'basic',
      showNextReviewInterval: false,
    });
  });

  it('leaves basic with intervals out of the cycle', async () => {
    saveReviewPreferences('user-1', {
      reviewMode: 'basic',
      showNextReviewInterval: true,
    });
    const result = render(<ReviewSession deckId="d1" />);

    await result.findByText('gato');
    fireEvent.press(result.getByText('Show answer'));
    fireEvent(result.getByText('Forgot'), 'longPress');

    expect(loadReviewPreferences('user-1')).toEqual({
      reviewMode: 'extended',
      showNextReviewInterval: false,
    });
  });

  it('deletes the card from the edit header after asking, then moves on', async () => {
    const result = render(<ReviewSession deckId="d1" />);

    await result.findByText('gato');
    fireEvent.press(result.getByLabelText('Edit this card'));
    fireEvent.press(result.getByLabelText('Delete card'));
    expect(result.getByText('Delete "**gato**"?')).toBeTruthy();

    // No goes back to editing without deleting.
    fireEvent.press(result.getByText('No'));
    expect(result.getByText('Edit card')).toBeTruthy();
    expect(mockDeleteNote).not.toHaveBeenCalled();

    fireEvent.press(result.getByLabelText('Delete card'));
    fireEvent.press(result.getByText('Delete'));
    await waitFor(() => expect(mockDeleteNote).toHaveBeenCalledWith('n1'));
    expect(await result.findByText('Review complete')).toBeTruthy();
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('offers no delete for a new card', async () => {
    const result = render(<ReviewSession deckId="d1" />);

    await result.findByText('gato');
    fireEvent.press(result.getByLabelText('Add a card'));
    expect(result.getByText('New card')).toBeTruthy();
    expect(result.queryByLabelText('Delete card')).toBeNull();
  });
});
