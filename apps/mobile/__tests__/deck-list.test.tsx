import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { DeckList } from '@/components/deck-list';

const manager = { tag: 'manager' };
let mockSessionDb: { manager: unknown } = { manager };
jest.mock('../lib/database-provider', () => ({
  useSessionDatabase: () => mockSessionDb,
}));

const mockWrites = {
  create: jest.fn(() => Promise.resolve({})),
  update: jest.fn(() => Promise.resolve({})),
  remove: jest.fn(() => Promise.resolve(undefined)),
};
let mockDecksState: {
  decks: { id: string; title: string; description: string | null }[];
  isLoading: boolean;
  error: Error | null;
  cardCount: (id: string) => number;
  writes: typeof mockWrites | null;
};
jest.mock('../lib/decks', () => ({
  useDecks: () => mockDecksState,
}));

beforeEach(() => {
  mockSessionDb = { manager };
  mockDecksState = {
    decks: [
      { id: 'd1', title: 'Spanish', description: 'Verbs' },
      { id: 'd2', title: 'Yoga', description: null },
    ],
    isLoading: false,
    error: null,
    cardCount: (id) => (id === 'd1' ? 12 : 0),
    writes: mockWrites,
  };
  mockWrites.create.mockClear();
  mockWrites.update.mockClear();
  mockWrites.remove.mockClear();
  mockWrites.create.mockResolvedValue({});
});

describe('DeckList', () => {
  it('waits for the database manager before rendering decks', () => {
    mockSessionDb = { manager: null };
    const { queryByText } = render(<DeckList />);
    expect(queryByText('My decks')).toBeNull();
  });

  it('lists decks with their card counts', () => {
    const { getByText } = render(<DeckList />);
    expect(getByText('Spanish')).toBeTruthy();
    expect(getByText('Verbs')).toBeTruthy();
    expect(getByText('12 cards')).toBeTruthy();
    expect(getByText('0 cards')).toBeTruthy();
  });

  it('shows the empty state without decks', () => {
    mockDecksState.decks = [];
    const { getByText } = render(<DeckList />);
    expect(getByText('No decks yet. Create your first one.')).toBeTruthy();
  });

  it('creates a deck and closes the form once the write landed', async () => {
    const { getByText, getByPlaceholderText, queryByText } = render(
      <DeckList />,
    );
    fireEvent.press(getByText('New deck'));
    fireEvent.changeText(
      getByPlaceholderText('e.g. Spanish vocabulary'),
      'Anatomy',
    );
    fireEvent.press(getByText('Save'));
    await waitFor(() =>
      expect(mockWrites.create).toHaveBeenCalledWith('Anatomy', ''),
    );
    await act(async () => {});
    expect(queryByText('Save')).toBeNull();
  });

  it('keeps the form open and shows the error when the write fails', async () => {
    mockWrites.create.mockRejectedValueOnce(
      new Error('Database not initialized'),
    );
    const { getByText, getByPlaceholderText, getByDisplayValue } = render(
      <DeckList />,
    );
    fireEvent.press(getByText('New deck'));
    fireEvent.changeText(
      getByPlaceholderText('e.g. Spanish vocabulary'),
      'Anatomy',
    );
    fireEvent.press(getByText('Save'));
    await waitFor(() => getByText('Database not initialized'));
    expect(getByDisplayValue('Anatomy')).toBeTruthy();
  });

  it('edits a deck with its current values', async () => {
    const { getByLabelText, getByDisplayValue, getByText } = render(
      <DeckList />,
    );
    fireEvent.press(getByLabelText('Edit Spanish'));
    fireEvent.changeText(getByDisplayValue('Spanish'), 'Spanish verbs');
    fireEvent.press(getByText('Save'));
    await waitFor(() =>
      expect(mockWrites.update).toHaveBeenCalledWith(
        'd1',
        'Spanish verbs',
        'Verbs',
      ),
    );
  });

  it('asks for confirmation before deleting', async () => {
    const { getByLabelText, getByText } = render(<DeckList />);
    fireEvent.press(getByLabelText('Delete Yoga'));
    expect(mockWrites.remove).not.toHaveBeenCalled();
    fireEvent.press(getByText('Delete deck'));
    await waitFor(() => expect(mockWrites.remove).toHaveBeenCalledWith('d2'));
  });
});

describe('DeckList action state', () => {
  const failCreate = async (
    r: ReturnType<typeof render>,
    message = 'Database not initialized',
  ) => {
    mockWrites.create.mockRejectedValueOnce(new Error(message));
    fireEvent.press(r.getByText('New deck'));
    fireEvent.changeText(
      r.getByPlaceholderText('e.g. Spanish vocabulary'),
      'Anatomy',
    );
    fireEvent.press(r.getByText('Save'));
    await waitFor(() => r.getByText(message));
  };

  it('does not start a second delete while one is pending', async () => {
    let finish!: () => void;
    mockWrites.remove.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          finish = () => resolve(undefined);
        }),
    );
    const { getByLabelText, getByText } = render(<DeckList />);
    fireEvent.press(getByLabelText('Delete Yoga'));
    fireEvent.press(getByText('Delete deck'));
    fireEvent.press(getByText('Delete deck'));
    expect(mockWrites.remove).toHaveBeenCalledTimes(1);

    // Cancel is held too, so the confirmation stays until the write settles.
    fireEvent.press(getByText('Cancel'));
    expect(getByText(/Delete this deck\?/)).toBeTruthy();

    await act(async () => finish());
  });

  it('shows a failed delete next to its confirmation', async () => {
    mockWrites.remove.mockRejectedValueOnce(new Error('Deck is locked'));
    const { getByLabelText, getByText } = render(<DeckList />);
    fireEvent.press(getByLabelText('Delete Yoga'));
    fireEvent.press(getByText('Delete deck'));
    await waitFor(() => getByText('Deck is locked'));
    expect(getByText(/Delete this deck\?/)).toBeTruthy();
  });

  it('clears the error when a failed action is cancelled', async () => {
    const r = render(<DeckList />);
    await failCreate(r);
    fireEvent.press(r.getByText('Cancel'));
    expect(r.queryByText('Database not initialized')).toBeNull();
  });

  it('does not carry an earlier error into the next action', async () => {
    const r = render(<DeckList />);
    await failCreate(r);
    fireEvent.press(r.getByText('Cancel'));
    fireEvent.press(r.getByLabelText('Edit Spanish'));
    expect(r.queryByText('Database not initialized')).toBeNull();
    fireEvent.press(r.getByText('Cancel'));
    fireEvent.press(r.getByLabelText('Delete Spanish'));
    expect(r.queryByText('Database not initialized')).toBeNull();
  });
});
