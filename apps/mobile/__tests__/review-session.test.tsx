import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils';
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
    template_key?: string;
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

  it('reveals the answer when the empty answer space is tapped', async () => {
    const result = render(<ReviewSession deckId="d1" />);

    await result.findByText('gato');
    fireEvent.press(result.getByLabelText('Answer, tap to show'));
    expect(result.getByText('cat')).toBeTruthy();
    expect(result.getByLabelText('Answer')).toBeTruthy();
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

  it('reveals the answer below the question when the question is tapped', async () => {
    const result = render(<ReviewSession deckId="d1" />);

    expect(await result.findByText('gato')).toBeTruthy();
    expect(result.queryByText('cat')).toBeNull();
    fireEvent.press(result.getByLabelText('Show the answer'));

    // Both stay, so the answer can be checked against the question.
    expect(result.getByText('cat')).toBeTruthy();
    expect(result.getByText('gato')).toBeTruthy();
    fireEvent.press(result.getByLabelText('Question'));
    expect(result.getByText('cat')).toBeTruthy();
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

  it('renders Markdown, keeps the question beside the answer, and records a rating', async () => {
    const result = render(<ReviewSession deckId="d1" />);

    expect(await result.findByText('gato')).toHaveStyle({ fontWeight: 'bold' });
    fireEvent.press(result.getByText('Show answer'));
    expect(result.getByText('gato')).toBeTruthy();
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

  it('shows the live text of the current card after an edit', async () => {
    const result = render(<ReviewSession deckId="d1" />);

    await result.findByText('gato');
    mockReviewState = {
      ...mockReviewState,
      dueCards: [{ ...mockReviewState.dueCards[0]!, front: 'perro' }],
    };
    result.rerender(<ReviewSession deckId="d1" />);
    expect(result.getByText('perro')).toBeTruthy();
    expect(result.queryByText('gato')).toBeNull();
  });

  it('drops the other cards of a deleted note from the session', async () => {
    const card = mockReviewState.dueCards[0]!;
    mockReviewState = {
      ...mockReviewState,
      dueCards: [
        card,
        { ...card, id: 'c2', front: 'cat', back: 'gato', due_at: 2 },
        { ...card, id: 'c3', note_id: 'n2', front: 'perro', due_at: 3 },
      ],
    };
    const result = render(<ReviewSession deckId="d1" />);

    await result.findByText('gato');
    fireEvent.press(result.getByLabelText('Edit this card'));
    fireEvent.press(result.getByLabelText('Delete card'));
    fireEvent.press(result.getByText('Delete'));

    await waitFor(() => expect(mockDeleteNote).toHaveBeenCalledWith('n1'));
    // The sibling waits for a later batch, which must not bring it back.
    expect(await result.findByText('perro')).toBeTruthy();
    fireEvent.press(result.getByText('Show answer'));
    fireEvent.press(result.getByText('Remembered'));
    await waitFor(() => expect(mockRecord).toHaveBeenCalledWith('c3', 3));
    expect(await result.findByText('Review complete')).toBeTruthy();
  });

  it('offers no delete for a new card', async () => {
    const result = render(<ReviewSession deckId="d1" />);

    await result.findByText('gato');
    fireEvent.press(result.getByLabelText('Add a card'));
    expect(result.getByText('New card')).toBeTruthy();
    expect(result.queryByLabelText('Delete card')).toBeNull();
  });

  describe('swipe', () => {
    const drag = (x: number, y: number) =>
      fireGestureHandler(getByGestureTestId('review-card-swipe'), [
        { state: State.BEGAN },
        { state: State.ACTIVE, translationX: x, translationY: y },
        { state: State.END, translationX: x, translationY: y },
      ]);

    it('records the answer of a swipe past the threshold after the card leaves', async () => {
      const result = render(<ReviewSession deckId="d1" />);

      await result.findByText('gato');
      fireEvent.press(result.getByText('Show answer'));
      drag(300, 0);

      // remember is rating 3, as the Remembered button records
      await waitFor(() => expect(mockRecord).toHaveBeenCalledWith('c1', 3));
    });

    it('answers a card once when a button is pressed while it leaves', async () => {
      const result = render(<ReviewSession deckId="d1" />);

      await result.findByText('gato');
      fireEvent.press(result.getByText('Show answer'));
      drag(300, 0);
      await waitFor(() =>
        expect(result.getByRole('button', { name: /Forgot/ })).toBeDisabled(),
      );
      fireEvent.press(result.getByText('Forgot'));
      drag(300, 0);

      await waitFor(() => expect(mockRecord).toHaveBeenCalledWith('c1', 3));
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(mockRecord).toHaveBeenCalledTimes(1);
    });

    it('shows the next question in place while the answer is saved', async () => {
      const card = mockReviewState.dueCards[0]!;
      mockReviewState = {
        ...mockReviewState,
        dueCards: [
          card,
          { ...card, id: 'c2', note_id: 'n2', front: 'perro', due_at: 2 },
        ],
      };
      let finishSave = () => {};
      mockRecord.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishSave = () => resolve({ id: 'review-1' });
          }),
      );
      const result = render(<ReviewSession deckId="d1" />);

      await result.findByText('gato');
      fireEvent.press(result.getByText('Show answer'));
      drag(300, 0);

      await waitFor(() => expect(mockRecord).toHaveBeenCalledWith('c1', 3));
      expect(result.queryByText('cat')).toBeNull();
      expect(result.queryByText('gato')).toBeNull();
      expect(result.getByText('perro')).toBeTruthy();

      finishSave();
      expect(await result.findByText('Show answer')).toBeTruthy();
      expect(result.getByText('perro')).toBeTruthy();
    });

    it('records nothing for a short drag or before the answer shows', async () => {
      const result = render(<ReviewSession deckId="d1" />);

      await result.findByText('gato');
      // Before the answer shows there is no answer card, so nothing to swipe.
      expect(() => getByGestureTestId('review-card-swipe')).toThrow();
      fireEvent.press(result.getByText('Show answer'));
      drag(40, 0);

      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(mockRecord).not.toHaveBeenCalled();
    });

    it('gives hard for up only with four answers', async () => {
      const result = render(<ReviewSession deckId="d1" />);

      await result.findByText('gato');
      fireEvent.press(result.getByText('Show answer'));
      drag(0, -300);
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(mockRecord).not.toHaveBeenCalled();

      saveReviewPreferences('user-1', {
        reviewMode: 'extended',
        showNextReviewInterval: false,
      });
      result.unmount();
      const extended = render(<ReviewSession deckId="d1" />);
      await extended.findByText('gato');
      fireEvent.press(extended.getByText('Show answer'));
      drag(0, -300);
      await waitFor(() => expect(mockRecord).toHaveBeenCalledWith('c1', 2));
    });

    it('answers easy down and to the right, only with four answers', async () => {
      // The test window is 750 wide, so a quarter (188) commits; 250 by 250
      // is 45 degrees below horizontal.
      const result = render(<ReviewSession deckId="d1" />);
      await result.findByText('gato');
      fireEvent.press(result.getByText('Show answer'));
      drag(250, 250);
      await waitFor(() => expect(mockRecord).toHaveBeenCalledWith('c1', 3));
      result.unmount();
      mockRecord.mockClear();

      saveReviewPreferences('user-1', {
        reviewMode: 'extended',
        showNextReviewInterval: false,
      });
      const extended = render(<ReviewSession deckId="d1" />);
      await extended.findByText('gato');
      fireEvent.press(extended.getByText('Show answer'));
      drag(250, 250);
      await waitFor(() => expect(mockRecord).toHaveBeenCalledWith('c1', 4));
    });

    it('opens the delete question for a swipe down', async () => {
      const result = render(<ReviewSession deckId="d1" />);

      await result.findByText('gato');
      fireEvent.press(result.getByText('Show answer'));
      drag(0, 300);

      expect(await result.findByText('Delete "**gato**"?')).toBeTruthy();
      expect(mockDeleteNote).not.toHaveBeenCalled();
      expect(mockRecord).not.toHaveBeenCalled();
    });
  });

  it("shows a word card's translation and, below it, the rest of the answer", async () => {
    mockReviewState.dueCards = [
      {
        ...mockReviewState.dueCards[0],
        template_key: 'word-to-translation',
        back: 'cat\n\nEl gato duerme.',
      },
    ];
    const result = render(<ReviewSession deckId="d1" />);

    await result.findByText('gato');
    fireEvent.press(result.getByText('Show answer'));
    expect(result.getByText('cat')).toBeTruthy();
    expect(result.getByText('El gato duerme.')).toBeTruthy();
  });
});
