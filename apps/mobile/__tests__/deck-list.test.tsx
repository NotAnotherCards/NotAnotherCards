import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { DeckList } from '@/components/deck-list';
import i18n from '@/lib/i18n';
import { renderWithLocale } from '@/lib/test-utils/render-with-locale';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

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
  decks: {
    id: string;
    title: string;
    description: string | null;
    note_type: string;
    native_language_id?: string | null;
    target_language_id?: string | null;
    visibility?: string;
  }[];
  isLoading: boolean;
  error: Error | null;
  cardCount: (id: string) => number;
  dueCount: (id: string) => number;
  profile: {
    native_language_id: string | null;
    target_language_id: string | null;
  } | null;
  writes: typeof mockWrites | null;
};
jest.mock('../lib/decks', () => ({
  useDecks: () => mockDecksState,
}));

beforeEach(() => {
  mockSessionDb = { manager };
  mockDecksState = {
    decks: [
      {
        id: 'd1',
        title: 'Spanish',
        description: 'Verbs',
        note_type: 'word',
        native_language_id: '00000000-0000-0000-0000-000000000003',
        target_language_id: '00000000-0000-0000-0000-000000000002',
      },
      { id: 'd2', title: 'Yoga', description: null, note_type: 'basic' },
    ],
    isLoading: false,
    error: null,
    cardCount: (id) => (id === 'd1' ? 12 : 0),
    dueCount: (id) => (id === 'd1' ? 3 : 0),
    profile: null,
    writes: mockWrites,
  };
  mockWrites.create.mockClear();
  mockWrites.update.mockClear();
  mockWrites.remove.mockClear();
  mockWrites.create.mockResolvedValue({});
});

describe('DeckList', () => {
  it('separates a load error prefix from its message', () => {
    mockDecksState.error = new Error('Database unavailable');
    const screen = render(<DeckList />);
    expect(
      screen.getByText('Failed to load decks: Database unavailable'),
    ).toBeTruthy();
  });
  it.each([
    ['en', 'Cards', 'Review'],
    ['de', 'Karten', 'Wiederholen'],
    ['es', 'Tarjetas', 'Repasar'],
    ['ru', 'Карточки', 'Повторить'],
  ] as const)(
    'uses compact library actions in %s',
    async (locale, edit, review) => {
      const screen = await renderWithLocale(<DeckList />, locale);
      expect(screen.getAllByText(edit)).toHaveLength(3);
      expect(screen.getAllByText(review)).toHaveLength(2);
      const editLabel = screen.i18n.t('mobile.manage_deck', {
        title: 'Spanish',
      });
      const reviewLabel = screen.i18n.t('mobile.review_deck', {
        title: 'Spanish',
      });
      expect(editLabel).toContain(edit);
      expect(reviewLabel).toContain(review);
      fireEvent.press(screen.getByLabelText(editLabel));
      expect(mockPush).toHaveBeenLastCalledWith('/deck/d1');
      fireEvent.press(screen.getByLabelText(reviewLabel));
      expect(mockPush).toHaveBeenLastCalledWith('/review/d1');
    },
  );
  it('uses short German actions with descriptive screen-reader labels', async () => {
    const screen = await renderWithLocale(<DeckList />, 'de');
    expect(screen.getAllByText('Karten').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Wiederholen').length).toBeGreaterThan(0);
    for (const label of screen.getAllByText('Wiederholen')) {
      expect(label.props.numberOfLines).toBe(1);
    }
    expect(screen.getAllByText('Alle Karten')).toHaveLength(2);
    expect(screen.getAllByText('Fällig')).toHaveLength(2);
    fireEvent.press(screen.getByLabelText('Karten in Spanish'));
    expect(mockPush).toHaveBeenCalledWith('/deck/d1');
  });
  it('marks a published deck', () => {
    mockDecksState.decks = [
      { ...mockDecksState.decks[0]!, visibility: 'public' },
      ...mockDecksState.decks.slice(1),
    ];
    const { getByText, queryByText } = render(<DeckList />);
    expect(getByText('Published')).toBeTruthy();
    expect(queryByText('Private')).toBeNull();
  });

  it('opens the deck from Manage cards', async () => {
    const { findByLabelText } = render(<DeckList />);
    fireEvent.press(await findByLabelText('Cards in Spanish'));
    expect(mockPush).toHaveBeenCalledWith('/deck/d1');
  });

  it('waits for the database manager before rendering decks', () => {
    mockSessionDb = { manager: null };
    const { queryByText } = render(<DeckList />);
    expect(queryByText('My decks')).toBeNull();
  });

  it('lists decks with their card counts', () => {
    const { getByText, getByTestId, getByLabelText, UNSAFE_getAllByProps } =
      render(<DeckList />);
    expect(
      UNSAFE_getAllByProps({ role: 'listitem' }).filter(
        (el) => typeof el.type === 'string',
      ),
    ).toHaveLength(2);
    expect(getByText('Spanish')).toBeTruthy();
    expect(getByText('Verbs')).toBeTruthy();
    expect(getByText('12')).toBeTruthy();
    // the kind pill names the deck the way web does
    expect(getByLabelText('🇩🇪 German → 🇪🇸 Spanish')).toBeTruthy();
    expect(getByLabelText('Card deck')).toBeTruthy();
    // the deck with work is accented, the empty one stays muted
    expect(getByTestId('deck-due-d1')).toHaveTextContent('3');
    expect(getByTestId('deck-due-d1').props.className).toContain(
      'text-primary',
    );
    expect(getByTestId('deck-due-d2').props.className).toContain(
      'text-muted-foreground',
    );
  });

  it('localizes the word deck accessibility label', async () => {
    await act(async () => {
      await i18n.changeLanguage('de');
    });
    const { getByLabelText, rerender } = render(<DeckList />);
    expect(getByLabelText('🇩🇪 Deutsch → 🇪🇸 Spanisch')).toBeTruthy();

    await act(async () => {
      await i18n.changeLanguage('ru');
    });
    rerender(<DeckList />);
    expect(getByLabelText('🇩🇪 Немецкий → 🇪🇸 Испанский')).toBeTruthy();

    await act(async () => {
      await i18n.changeLanguage('en');
    });
  });

  it('starts a deck review from the list, whatever is due', () => {
    // nothing due: the review screen offers to activate more
    const { getByLabelText } = render(<DeckList />);

    fireEvent.press(getByLabelText('Review Yoga'));
    expect(mockPush).toHaveBeenCalledWith('/review/d2');

    fireEvent.press(getByLabelText('Review Spanish'));
    expect(mockPush).toHaveBeenCalledWith('/review/d1');
  });

  it('shows the empty state without decks', () => {
    mockDecksState.decks = [];
    const { getByText } = render(<DeckList />);
    expect(getByText(/No decks yet/)).toBeTruthy();
  });

  it('creates a deck and closes the form once the write landed', async () => {
    const { getByText, getByPlaceholderText, queryByText } = render(
      <DeckList createRequestKey={1} />,
    );
    fireEvent.changeText(
      getByPlaceholderText('e.g. Spanish vocabulary'),
      'Anatomy',
    );
    fireEvent.press(getByText('Save'));
    await waitFor(() =>
      expect(mockWrites.create).toHaveBeenCalledWith('Anatomy', '', {
        noteType: 'basic',
        nativeLanguageId: null,
        targetLanguageId: null,
      }),
    );
    await act(async () => {});
    expect(queryByText('Save')).toBeNull();
  });

  it('keeps the form open and shows the error when the write fails', async () => {
    mockWrites.create.mockRejectedValueOnce(
      new Error('Database not initialized'),
    );
    const { getByText, getByPlaceholderText, getByDisplayValue } = render(
      <DeckList createRequestKey={1} />,
    );
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

  it('opens the deck from its header', () => {
    const { getByLabelText } = render(<DeckList />);
    fireEvent.press(getByLabelText('Open Spanish'));
    expect(mockPush).toHaveBeenCalledWith('/deck/d1');
  });

  it('asks for confirmation before deleting', async () => {
    const { getByLabelText, getByText } = render(<DeckList />);
    fireEvent.press(getByLabelText('Delete Yoga'));
    expect(mockWrites.remove).not.toHaveBeenCalled();
    fireEvent.press(getByText('Delete Deck'));
    await waitFor(() => expect(mockWrites.remove).toHaveBeenCalledWith('d2'));
  });
});

describe('DeckList action state', () => {
  const failCreate = async (
    r: ReturnType<typeof render>,
    message = 'Database not initialized',
  ) => {
    mockWrites.create.mockRejectedValueOnce(new Error(message));
    fireEvent.changeText(
      r.getByPlaceholderText('e.g. Spanish vocabulary'),
      'Anatomy',
    );
    fireEvent.press(r.getByText('Save'));
    await waitFor(() => r.getByText(message));
  };

  it('locks every other deck action while a write is pending', async () => {
    let finish!: () => void;
    mockWrites.remove.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          finish = () => resolve(undefined);
        }),
    );
    const { getByLabelText, getByText, queryByText, queryByPlaceholderText } =
      render(<DeckList />);
    fireEvent.press(getByLabelText('Delete Yoga'));
    fireEvent.press(getByText('Delete Deck'));
    // Yoga's delete is in flight; Spanish must not be able to take the state
    fireEvent.press(getByLabelText('Edit Spanish'));
    expect(queryByPlaceholderText('e.g. Spanish vocabulary')).toBeNull();
    expect(getByText(/Delete this deck\?/)).toBeTruthy();
    await act(async () => finish());
    expect(queryByText(/Delete this deck\?/)).toBeNull();
    expect(queryByPlaceholderText('e.g. Spanish vocabulary')).toBeNull();
  });

  it('drops a create request that arrives during a write', async () => {
    let finish!: () => void;
    mockWrites.remove.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          finish = () => resolve(undefined);
        }),
    );
    const r = render(<DeckList createRequestKey={0} />);
    fireEvent.press(r.getByLabelText('Delete Yoga'));
    fireEvent.press(r.getByText('Delete Deck'));
    // the library's plus during the delete: the form must not replace the
    // pending action and inherit its outcome
    r.rerender(<DeckList createRequestKey={1} />);
    expect(r.queryByPlaceholderText('e.g. Spanish vocabulary')).toBeNull();
    expect(r.getByText(/Delete this deck\?/)).toBeTruthy();
    await act(async () => finish());
    expect(r.queryByPlaceholderText('e.g. Spanish vocabulary')).toBeNull();
  });

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
    fireEvent.press(getByText('Delete Deck'));
    fireEvent.press(getByText('Delete Deck'));
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
    fireEvent.press(getByText('Delete Deck'));
    await waitFor(() => getByText('Deck is locked'));
    expect(getByText(/Delete this deck\?/)).toBeTruthy();
  });

  it('clears the error when a failed action is cancelled', async () => {
    const r = render(<DeckList createRequestKey={1} />);
    await failCreate(r);
    fireEvent.press(r.getByText('Cancel'));
    expect(r.queryByText('Database not initialized')).toBeNull();
  });

  it('does not carry an earlier error into the next action', async () => {
    const r = render(<DeckList createRequestKey={1} />);
    await failCreate(r);
    fireEvent.press(r.getByText('Cancel'));
    fireEvent.press(r.getByLabelText('Edit Spanish'));
    expect(r.queryByText('Database not initialized')).toBeNull();
    fireEvent.press(r.getByText('Cancel'));
    fireEvent.press(r.getByLabelText('Delete Spanish'));
    expect(r.queryByText('Database not initialized')).toBeNull();
  });

  it('keeps open, edit and delete as three separate press targets', () => {
    mockPush.mockClear();
    const { getByLabelText, queryByText } = render(<DeckList />);
    const open = getByLabelText('Open Spanish');
    const edit = getByLabelText('Edit Spanish');
    const remove = getByLabelText('Delete Spanish');

    // Neither button sits inside the opening target.
    const inside = (node: typeof edit | null, ancestor: typeof open) => {
      for (let at = node; at; at = at.parent) if (at === ancestor) return true;
      return false;
    };
    expect(inside(edit, open)).toBe(false);
    expect(inside(remove, open)).toBe(false);

    fireEvent.press(remove);
    expect(queryByText(/Delete this deck\?/)).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();

    fireEvent.press(open);
    expect(mockPush).toHaveBeenCalledWith('/deck/d1');
  });
});
