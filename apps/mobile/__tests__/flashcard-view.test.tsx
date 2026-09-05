import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { FlashcardView } from '@/components/flashcard-view';

const manager = { tag: 'manager' };
let mockSessionDb: { manager: unknown } = { manager };
jest.mock('../lib/database-provider', () => ({
  useSessionDatabase: () => mockSessionDb,
}));

const mockWrites = {
  recordReview: jest.fn(() => Promise.resolve({})),
};
type MockCard = {
  id: string;
  note_id: string;
  front: string;
  back: string;
  scheduled_interval_minutes: number;
};
let mockCardsState: {
  deck: { id: string; title: string } | null;
  cards: MockCard[];
  isLoading: boolean;
  error: Error | null;
  writes: typeof mockWrites | null;
};
const mockScreenOptions = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({ options }: { options: unknown }) => {
      mockScreenOptions(options);
      return null;
    },
  },
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('../lib/cards', () => ({
  useCards: () => mockCardsState,
}));

const card = (id: string, front: string, back: string): MockCard => ({
  id,
  note_id: `n${id.slice(1)}`,
  front,
  back,
  scheduled_interval_minutes: 0,
});

beforeEach(() => {
  mockSessionDb = { manager };
  mockCardsState = {
    deck: { id: 'd1', title: 'Spanish' },
    cards: [card('c1', 'hola', 'hello'), card('c2', 'adiós', 'goodbye')],
    isLoading: false,
    error: null,
    writes: mockWrites,
  };
  mockWrites.recordReview.mockClear();
  mockBack.mockClear();
});

describe('FlashcardView', () => {
  it('waits for the database manager before rendering', () => {
    mockSessionDb = { manager: null };
    expect(
      render(<FlashcardView deckId="d1" />).queryByText('hola'),
    ).toBeNull();
  });

  it('shows the front first and hides the answer until it is revealed', () => {
    const { getByText, queryByText, getByLabelText } = render(
      <FlashcardView deckId="d1" />,
    );
    expect(mockScreenOptions).toHaveBeenLastCalledWith({ title: 'Spanish' });
    expect(getByText('hola')).toBeTruthy();
    expect(queryByText('hello')).toBeNull();
    fireEvent.press(getByLabelText('Show the answer'));
    expect(getByText('hello')).toBeTruthy();
  });

  // Rating a card you have not answered is not a review.
  it('offers no ratings until the answer is showing', () => {
    const { queryByText, getByLabelText } = render(
      <FlashcardView deckId="d1" />,
    );
    expect(queryByText(/^Again/)).toBeNull();
    fireEvent.press(getByLabelText('Show the answer'));
    expect(queryByText(/^Again/)).toBeTruthy();
  });

  it('previews each rating interval from the shared scheduler', () => {
    const { getByLabelText, getByText } = render(<FlashcardView deckId="d1" />);
    fireEvent.press(getByLabelText('Show the answer'));
    // a fresh card: the scheduler's floors, 5m / 1d / 3d / 7d
    expect(getByText('Again (5m)')).toBeTruthy();
    expect(getByText('Hard (1d)')).toBeTruthy();
    expect(getByText('Good (3d)')).toBeTruthy();
    expect(getByText('Easy (7d)')).toBeTruthy();
  });

  it('records the rating and advances to the next card, front first', async () => {
    const { getByLabelText, getByText, queryByText } = render(
      <FlashcardView deckId="d1" />,
    );
    fireEvent.press(getByLabelText('Show the answer'));
    fireEvent.press(getByText('Good (3d)'));
    await waitFor(() =>
      expect(mockWrites.recordReview).toHaveBeenCalledWith('c1', 3),
    );
    await act(async () => {});
    expect(getByText('adiós')).toBeTruthy();
    // the next card's answer must not already be showing
    expect(queryByText('goodbye')).toBeNull();
  });

  it('keeps the card and reports the error when the write fails', async () => {
    mockWrites.recordReview.mockRejectedValueOnce(
      new Error('Database not initialized'),
    );
    const { getByLabelText, getByText } = render(<FlashcardView deckId="d1" />);
    fireEvent.press(getByLabelText('Show the answer'));
    fireEvent.press(getByText('Good (3d)'));
    await waitFor(() => getByText('Database not initialized'));
    expect(getByText('hello')).toBeTruthy();
  });

  it('does not record a second rating while one is pending', async () => {
    let finish!: () => void;
    mockWrites.recordReview.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({});
        }),
    );
    const { getByLabelText, getByText } = render(<FlashcardView deckId="d1" />);
    fireEvent.press(getByLabelText('Show the answer'));
    fireEvent.press(getByText('Good (3d)'));
    fireEvent.press(getByText('Easy (7d)'));
    expect(mockWrites.recordReview).toHaveBeenCalledTimes(1);
    await act(async () => finish());
  });

  it('wraps around the deck with Previous and Next, always front first', () => {
    const { getByLabelText, getByText, queryByText } = render(
      <FlashcardView deckId="d1" />,
    );
    expect(getByText('1 / 2')).toBeTruthy();
    fireEvent.press(getByLabelText('Show the answer'));
    fireEvent.press(getByLabelText('Next card'));
    expect(getByText('2 / 2')).toBeTruthy();
    expect(queryByText('goodbye')).toBeNull();
    fireEvent.press(getByLabelText('Next card'));
    expect(getByText('1 / 2')).toBeTruthy();
    fireEvent.press(getByLabelText('Previous card'));
    expect(getByText('2 / 2')).toBeTruthy();
  });

  it('leaves the screen after rating the only card in the deck', async () => {
    mockCardsState.cards = [card('c1', 'hola', 'hello')];
    const { getByLabelText, getByText, queryByText } = render(
      <FlashcardView deckId="d1" />,
    );
    // a single card has nothing to navigate between
    expect(queryByText('1 / 1')).toBeNull();
    fireEvent.press(getByLabelText('Show the answer'));
    fireEvent.press(getByText('Good (3d)'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('shows the empty, missing and failed states', () => {
    mockCardsState.cards = [];
    const r = render(<FlashcardView deckId="d1" />);
    expect(r.getByText(/no cards yet/)).toBeTruthy();
    mockCardsState.deck = null;
    r.rerender(<FlashcardView deckId="d1" />);
    expect(r.getByText('This deck is not on this device.')).toBeTruthy();
    mockCardsState.error = new Error('nope');
    r.rerender(<FlashcardView deckId="d1" />);
    expect(r.getByText('Failed to load cards: nope')).toBeTruthy();
  });
});
