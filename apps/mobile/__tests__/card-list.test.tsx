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
const mockScreenOptions = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({ options }: { options: unknown }) => {
      mockScreenOptions(options);
      return null;
    },
  },
  useRouter: () => ({ push: mockPush }),
}));

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
  mockPush.mockClear();
});

describe('CardList', () => {
  it('waits for the database manager before rendering', () => {
    mockSessionDb = { manager: null };
    expect(render(<CardList deckId="d1" />).queryByText('Cards')).toBeNull();
  });

  it('puts the deck title in the header and lists the cards with front and back', () => {
    const { getByText, UNSAFE_getAllByProps } = render(
      <CardList deckId="d1" />,
    );
    expect(mockScreenOptions).toHaveBeenLastCalledWith({ title: 'Spanish' });
    // *ByRole only sees accessibility elements; a list container must not be
    // one (it would swallow its items), so pin the prop on the host views.
    const hosts = (role: string) =>
      UNSAFE_getAllByProps({ role }).filter(
        (el) => typeof el.type === 'string',
      );
    expect(hosts('list')).toHaveLength(1);
    expect(hosts('listitem')).toHaveLength(2);
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

  it('caps a long front in the accessibility labels', () => {
    mockCardsState.cards = [
      { id: 'c9', note_id: 'n9', front: 'x'.repeat(100), back: 'y' },
    ];
    const { getByLabelText } = render(<CardList deckId="d1" />);
    expect(getByLabelText(`Edit ${'x'.repeat(40)}…`)).toBeTruthy();
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

  it('locks every other card action while a write is pending', async () => {
    let finish!: () => void;
    mockWrites.deleteNote.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          finish = () => resolve(undefined);
        }),
    );
    const { getByLabelText, getByText, queryByText } = render(
      <CardList deckId="d1" />,
    );
    fireEvent.press(getByLabelText('Delete note hola'));
    fireEvent.press(getByText('Delete note'));
    // hola's delete is in flight; adiós must not be able to take the state
    // (c2 is not editable in this fixture, so its Remove action is the probe)
    fireEvent.press(getByLabelText('Remove adiós from deck'));
    expect(queryByText(/The note stays/)).toBeNull();
    expect(getByText(/review history go with it/)).toBeTruthy();
    await act(async () => finish());
    // the completed write closes its own dialog and nothing else opened
    expect(queryByText(/review history go with it/)).toBeNull();
    expect(queryByText(/The note stays/)).toBeNull();
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

describe('CardList review entry point', () => {
  it('opens the deck review route', () => {
    const { getByText } = render(<CardList deckId="d1" />);
    fireEvent.press(getByText('Review'));
    expect(mockPush).toHaveBeenCalledWith('/deck/d1/review');
  });

  it('offers no review for an empty deck', () => {
    mockCardsState.cards = [];
    expect(render(<CardList deckId="d1" />).queryByText('Review')).toBeNull();
  });
});
