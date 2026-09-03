import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { CardList } from '@/components/card-list';

const manager = { tag: 'manager' };
let mockSessionDb: { manager: unknown } = { manager };
jest.mock('../lib/database-provider', () => ({
  useSessionDatabase: () => mockSessionDb,
}));

const mockWrites = {
  create: jest.fn(() => Promise.resolve({})),
  update: jest.fn(() => Promise.resolve({})),
  removeFromDeck: jest.fn(() => Promise.resolve(undefined)),
  deleteNote: jest.fn(() => Promise.resolve(undefined)),
};
type MockCard = { id: string; note_id: string; front: string; back: string };
let mockCardsState: {
  deck: { id: string; title: string } | null;
  cards: MockCard[];
  isLoading: boolean;
  error: Error | null;
  canEdit: (card: MockCard) => boolean;
  writes: typeof mockWrites | null;
};
jest.mock('../lib/cards', () => ({
  useCards: () => mockCardsState,
}));

beforeEach(() => {
  mockSessionDb = { manager };
  mockCardsState = {
    deck: { id: 'd1', title: 'Spanish' },
    cards: [
      { id: 'c1', note_id: 'n1', front: 'hola', back: 'hello' },
      { id: 'c2', note_id: 'n2', front: 'adiós', back: 'goodbye' },
    ],
    isLoading: false,
    error: null,
    canEdit: (card) => card.id !== 'c2',
    writes: mockWrites,
  };
  Object.values(mockWrites).forEach((fn) => fn.mockClear());
});

describe('CardList', () => {
  it('waits for the database manager before rendering', () => {
    mockSessionDb = { manager: null };
    expect(render(<CardList deckId="d1" />).queryByText('Spanish')).toBeNull();
  });

  it('shows the deck title and lists the cards with front and back', () => {
    const { getByText } = render(<CardList deckId="d1" />);
    expect(getByText('Spanish')).toBeTruthy();
    expect(getByText('hola')).toBeTruthy();
    expect(getByText('hello')).toBeTruthy();
    expect(getByText('adiós')).toBeTruthy();
  });

  it('shows the empty state and the not-on-device state', () => {
    mockCardsState.cards = [];
    const r = render(<CardList deckId="d1" />);
    expect(r.getByText('No cards yet. Add your first one.')).toBeTruthy();
    mockCardsState.deck = null;
    r.rerender(<CardList deckId="d1" />);
    expect(r.getByText('This deck is not on this device.')).toBeTruthy();
  });

  it('offers Edit only for cards the rule allows', () => {
    const { queryByLabelText } = render(<CardList deckId="d1" />);
    expect(queryByLabelText('Edit hola')).toBeTruthy();
    expect(queryByLabelText('Edit adiós')).toBeNull();
  });

  it('creates a card in this deck and closes the form once the write landed', async () => {
    const { getByText, getByPlaceholderText, queryByText } = render(
      <CardList deckId="d1" />,
    );
    fireEvent.press(getByText('New card'));
    fireEvent.changeText(
      getByPlaceholderText('The question or prompt'),
      'gato',
    );
    fireEvent.changeText(getByPlaceholderText('The answer'), 'cat');
    fireEvent.press(getByText('Save'));
    await waitFor(() =>
      expect(mockWrites.create).toHaveBeenCalledWith('d1', 'gato', 'cat'),
    );
    await act(async () => {});
    expect(queryByText('Save')).toBeNull();
  });

  it('edits a card with its current values', async () => {
    const { getByLabelText, getByDisplayValue, getByText } = render(
      <CardList deckId="d1" />,
    );
    fireEvent.press(getByLabelText('Edit hola'));
    fireEvent.changeText(getByDisplayValue('hola'), 'hola!');
    fireEvent.press(getByText('Save'));
    await waitFor(() =>
      expect(mockWrites.update).toHaveBeenCalledWith('c1', 'hola!', 'hello'),
    );
  });

  it('remove asks first, then ends the membership and not the note', async () => {
    const { getByLabelText, getByText } = render(<CardList deckId="d1" />);
    fireEvent.press(getByLabelText('Remove hola from deck'));
    expect(getByText(/The note stays/)).toBeTruthy();
    expect(mockWrites.removeFromDeck).not.toHaveBeenCalled();
    fireEvent.press(getByText('Remove from deck'));
    await waitFor(() =>
      expect(mockWrites.removeFromDeck).toHaveBeenCalledWith('n1', 'd1'),
    );
    expect(mockWrites.deleteNote).not.toHaveBeenCalled();
  });

  it('delete asks first, then deletes the note', async () => {
    const { getByLabelText, getByText } = render(<CardList deckId="d1" />);
    fireEvent.press(getByLabelText('Delete note hola'));
    expect(getByText(/review history go with it/)).toBeTruthy();
    fireEvent.press(getByText('Delete note'));
    await waitFor(() =>
      expect(mockWrites.deleteNote).toHaveBeenCalledWith('n1'),
    );
    expect(mockWrites.removeFromDeck).not.toHaveBeenCalled();
  });

  it('does not start a second delete while one is pending', async () => {
    let finish!: () => void;
    mockWrites.deleteNote.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          finish = () => resolve(undefined);
        }),
    );
    const { getByLabelText, getByText } = render(<CardList deckId="d1" />);
    fireEvent.press(getByLabelText('Delete note hola'));
    fireEvent.press(getByText('Delete note'));
    fireEvent.press(getByText('Delete note'));
    expect(mockWrites.deleteNote).toHaveBeenCalledTimes(1);
    fireEvent.press(getByText('Cancel'));
    expect(getByText(/review history go with it/)).toBeTruthy();
    await act(async () => finish());
  });

  it('keeps the form open with the error when a write fails, and cancel clears it', async () => {
    mockWrites.create.mockRejectedValueOnce(
      new Error('Database not initialized'),
    );
    const r = render(<CardList deckId="d1" />);
    fireEvent.press(r.getByText('New card'));
    fireEvent.changeText(
      r.getByPlaceholderText('The question or prompt'),
      'gato',
    );
    fireEvent.changeText(r.getByPlaceholderText('The answer'), 'cat');
    fireEvent.press(r.getByText('Save'));
    await waitFor(() => r.getByText('Database not initialized'));
    expect(r.getByDisplayValue('gato')).toBeTruthy();
    fireEvent.press(r.getByText('Cancel'));
    expect(r.queryByText('Database not initialized')).toBeNull();
    fireEvent.press(r.getByLabelText('Edit hola'));
    expect(r.queryByText('Database not initialized')).toBeNull();
  });
});
