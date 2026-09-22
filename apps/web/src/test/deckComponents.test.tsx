import { describe, expect, it, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react';
import { DeckCard } from '../components/deck/DeckCard';
import { CardItem } from '../components/deck/CardItem';
import { CardList, CardListRef } from '../components/deck/CardList';
import { WordNoteList } from '../components/deck/WordNoteList';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FlashcardModal } from '../components/deck/FlashcardModal';
import { Deck, Card } from '../hooks/useStore';
import {
  WORD_TO_TRANSLATION_TEMPLATE_KEY,
  type UserNoteRecord,
} from '@repo/offline-db';
import { GERMAN, RUSSIAN } from '@repo/schemas';

vi.mock('@/offline/db', () => {
  const manager = {
    init: vi.fn().mockResolvedValue(undefined),
    state: { status: 'ready' },
    subscribe: vi.fn(() => () => {}),
  };
  return {
    manager,
    createUserDatabaseManager: vi.fn(() => manager),
    closeUserDatabase: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@/hooks/useStore', () => ({
  useStore: () => ({
    recordReview: vi.fn(),
  }),
}));

describe('DeckCard Component', () => {
  const mockDeck: Deck = {
    id: 'deck-test-1',
    title: 'Spanish Verbs',
    description: 'Learn essential conversational Spanish verbs.',
    visibility: 'private',
    note_type: 'basic',
    native_language_id: null,
    target_language_id: null,
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  it('renders the deck title, description, and total cards badge', () => {
    render(
      <DeckCard
        deck={mockDeck}
        totalCards={12}
        dueCount={3}
        onSelectDeck={vi.fn()}
        onStartReview={vi.fn()}
        onEditDeck={vi.fn()}
        onDeleteDeck={vi.fn()}
      />,
    );

    expect(screen.getByText('Spanish Verbs')).toBeInTheDocument();
    expect(
      screen.getByText('Learn essential conversational Spanish verbs.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('total-cards-badge')).toHaveTextContent('12');
  });

  it('adds a total words badge only for word decks', () => {
    render(
      <DeckCard
        deck={{
          ...mockDeck,
          note_type: 'word',
          native_language_id: 'ru',
          target_language_id: 'de',
        }}
        totalCards={3}
        totalWords={1}
        dueCount={2}
        onSelectDeck={vi.fn()}
        onStartReview={vi.fn()}
        onEditDeck={vi.fn()}
        onDeleteDeck={vi.fn()}
      />,
    );

    expect(screen.getByTestId('total-words-badge')).toHaveTextContent('1');
    expect(screen.getByTestId('total-cards-badge')).toHaveTextContent('3');
    expect(screen.getByText('Cards Due')).toBeInTheDocument();
    expect(screen.getByTestId('due-cards-badge')).toHaveTextContent('2');
  });

  // A push sends the client's whole view of a row, so an old client
  // rewriting a deck a newer one wrote could drop columns it never knew
  // about. Delete is a tombstone and carries no field values, so it stays as
  // the only way to be rid of a deck this client cannot use.
  it('hides Edit on a deck whose type it does not know, and keeps Delete', () => {
    render(
      <DeckCard
        deck={{ ...mockDeck, note_type: 'cloze' }}
        totalCards={0}
        dueCount={0}
        onSelectDeck={vi.fn()}
        onEditDeck={vi.fn()}
        onDeleteDeck={vi.fn()}
        onStartReview={vi.fn()}
      />,
    );

    expect(screen.queryByTitle('Edit Deck Details')).toBeNull();
    expect(screen.getByTitle('Delete Deck')).toBeInTheDocument();
  });

  it('offers Edit on a deck whose type it knows', () => {
    render(
      <DeckCard
        deck={mockDeck}
        totalCards={0}
        dueCount={0}
        onSelectDeck={vi.fn()}
        onEditDeck={vi.fn()}
        onDeleteDeck={vi.fn()}
        onStartReview={vi.fn()}
      />,
    );

    expect(screen.getByTitle('Edit Deck Details')).toBeInTheDocument();
  });

  it('calls action callbacks on click events', () => {
    const onSelectDeck = vi.fn();
    const onStartReview = vi.fn();
    const onEditDeck = vi.fn();
    const onDeleteDeck = vi.fn();

    render(
      <DeckCard
        deck={mockDeck}
        totalCards={12}
        dueCount={3}
        onSelectDeck={onSelectDeck}
        onStartReview={onStartReview}
        onEditDeck={onEditDeck}
        onDeleteDeck={onDeleteDeck}
      />,
    );

    // Click deck title
    fireEvent.click(screen.getByText('Spanish Verbs'));
    expect(onSelectDeck).toHaveBeenCalledWith('deck-test-1');

    // Click Edit icon button
    fireEvent.click(screen.getByTitle('Edit Deck Details'));
    expect(onEditDeck).toHaveBeenCalledWith(mockDeck);

    // Click Delete icon button
    fireEvent.click(screen.getByTitle('Delete Deck'));
    expect(onDeleteDeck).toHaveBeenCalledWith('deck-test-1');

    fireEvent.click(screen.getByRole('button', { name: 'Start Review' }));
    expect(onStartReview).toHaveBeenCalledWith('deck-test-1');
  });
});

describe('CardItem Component', () => {
  const mockCard: Card = {
    id: 'card-test-1',
    note_id: 'note-test-1',
    template_key: 'front-back',
    active: true,
    front: 'Hola',
    back: 'Hello',
    due_at: Date.now(),
    scheduled_interval_minutes: 0,
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  it('renders card front and back inside a table context', () => {
    render(
      <div>
        <CardItem
          card={mockCard}
          onEditCard={vi.fn()}
          onRemoveFromDeck={vi.fn()}
          onViewCard={vi.fn()}
        />
      </div>,
    );

    expect(screen.getByText('Hola')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('keeps word examples as a smaller second paragraph without restyling basic cards', () => {
    const { rerender } = render(
      <div>
        <CardItem
          card={{
            ...mockCard,
            template_key: WORD_TO_TRANSLATION_TEMPLATE_KEY,
            back: 'old\n\nAn old house',
          }}
          onEditCard={vi.fn()}
          onRemoveFromDeck={vi.fn()}
          onViewCard={vi.fn()}
        />
      </div>,
    );

    const wordBack = screen
      .getByText('An old house')
      .closest('.markdown-content');
    expect(wordBack?.querySelectorAll('p')).toHaveLength(2);
    expect(wordBack).toHaveClass('[&_p+p]:text-xs');

    rerender(
      <div>
        <CardItem
          card={{ ...mockCard, back: 'answer\n\nMore detail' }}
          onEditCard={vi.fn()}
          onRemoveFromDeck={vi.fn()}
          onViewCard={vi.fn()}
        />
      </div>,
    );

    expect(
      screen.getByText('More detail').closest('.markdown-content'),
    ).not.toHaveClass('[&_p+p]:text-xs');
  });

  it('triggers callbacks on view, edit, and remove-from-deck actions', () => {
    const onEditCard = vi.fn();
    const onRemoveFromDeck = vi.fn();
    const onViewCard = vi.fn();

    render(
      <div>
        <CardItem
          card={mockCard}
          onEditCard={onEditCard}
          onRemoveFromDeck={onRemoveFromDeck}
          onViewCard={onViewCard}
        />
      </div>,
    );

    // Click View button
    fireEvent.click(screen.getByTitle('View Card'));
    expect(onViewCard).toHaveBeenCalledWith(mockCard);

    // Click Edit button
    fireEvent.click(screen.getByTitle('Edit Card'));
    expect(onEditCard).toHaveBeenCalledWith(mockCard);

    // Click Remove from Deck button
    fireEvent.click(screen.getByTitle('Remove from Deck'));
    expect(onRemoveFromDeck).toHaveBeenCalledWith(mockCard);
  });

  it('hides the basic front/back editor for structured-note cards', () => {
    render(
      <div>
        <CardItem
          card={mockCard}
          onEditCard={vi.fn()}
          onRemoveFromDeck={vi.fn()}
          onViewCard={vi.fn()}
          canEdit={false}
        />
      </div>,
    );

    expect(screen.queryByTitle('Edit Card')).not.toBeInTheDocument();
    expect(screen.getByTitle('Remove from Deck')).toBeInTheDocument();
  });
});

describe('FlashcardModal Component', () => {
  const mockCard: Card = {
    id: 'card-test-1',
    note_id: 'note-test-1',
    template_key: 'front-back',
    active: true,
    front: 'Hola',
    back: 'Hello',
    due_at: Date.now(),
    scheduled_interval_minutes: 0,
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  it('renders front content by default and flips to back content on click', async () => {
    const onClose = vi.fn();
    render(<FlashcardModal card={mockCard} onClose={onClose} />);

    // Renders the Front text
    expect(screen.getByText('Hola')).toBeInTheDocument();

    // Click the card wrapper to flip it
    await act(async () => {
      fireEvent.click(screen.getByTestId('flashcard-inner'));
    });

    // Renders the Back text
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('is preview-only and closes with Escape', () => {
    const onClose = vi.fn();
    render(<FlashcardModal card={mockCard} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole('button', { name: /again|hard|good|easy/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /next|prev/i }),
    ).not.toBeInTheDocument();
  });
});

describe('WordNoteList Component', () => {
  const wordNote: UserNoteRecord = {
    id: 'word-note-1',
    note_type: 'word',
    fields_version: 1,
    fields_json: JSON.stringify({
      word: 'Hund',
      translation: 'dog',
      native_language_id: RUSSIAN,
      target_language_id: GERMAN,
      example: 'Der Hund läuft.',
      example_translation: 'The dog runs.',
      gender: 'der',
      pronunciation: 'hʊnt',
    }),
    additional_content: null,
    created_at: 0,
    updated_at: 0,
  };
  const wordCards: Card[] = [
    {
      id: 'word-card',
      note_id: 'word-note-1',
      template_key: WORD_TO_TRANSLATION_TEMPLATE_KEY,
      active: true,
      front: 'Hund',
      back: 'dog',
      due_at: 0,
      scheduled_interval_minutes: 0,
      created_at: 0,
      updated_at: 0,
    },
    {
      id: 'translation-card',
      note_id: 'word-note-1',
      template_key: 'translation-to-word',
      active: true,
      front: 'dog',
      back: 'Hund',
      due_at: 0,
      scheduled_interval_minutes: 0,
      created_at: 0,
      updated_at: 0,
    },
    {
      id: 'example-card',
      note_id: 'word-note-1',
      template_key: 'example-to-translation',
      active: true,
      front: 'Der Hund läuft.',
      back: 'The dog runs.',
      due_at: 0,
      scheduled_interval_minutes: 0,
      created_at: 0,
      updated_at: 0,
    },
  ];

  it('groups sibling cards into one word row with badges and filled details', () => {
    render(
      <WordNoteList
        notes={[wordNote]}
        cards={wordCards}
        dueCount={0}
        onViewNote={vi.fn()}
        onViewDetails={vi.fn()}
        onEditWord={vi.fn()}
        onRemoveWord={vi.fn()}
        canEdit
        canRemove
        onAddWord={vi.fn()}
      />,
    );

    expect(screen.getByText('1 Words')).toBeInTheDocument();
    expect(screen.getByText('3 Cards Total')).toBeInTheDocument();
    expect(screen.getByText('0 Cards Due')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Word' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Translation' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Cards' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Extra info' })).toBeInTheDocument();
    expect(screen.getByText('Hund')).toBeInTheDocument();
    expect(screen.getByText('dog')).toBeInTheDocument();
    expect(screen.getAllByText(/DE → RU/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/RU → DE/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Example → DE/).length).toBeGreaterThan(0);
    expect(
      screen
        .getAllByRole('button', { name: 'View 3 details' })
        .some((button) => button.textContent === '3'),
    ).toBe(true);
    fireEvent.click(screen.getAllByRole('button', { name: 'View 3 cards' })[0]);
    expect(
      screen.getByText('Cards created to review this word.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Audio')).toBeNull();
    expect(screen.getByLabelText('3 cards').textContent).toContain(
      'DE → RURU → DEExample → DE',
    );
  });

  it('routes view, edit, and removal through the word-to-translation sibling', () => {
    const onViewNote = vi.fn();
    const onViewDetails = vi.fn();
    const onEditWord = vi.fn();
    const onRemoveWord = vi.fn();
    render(
      <WordNoteList
        notes={[wordNote]}
        cards={wordCards}
        dueCount={0}
        onViewNote={onViewNote}
        onViewDetails={onViewDetails}
        onEditWord={onEditWord}
        onRemoveWord={onRemoveWord}
        canEdit
        canRemove
        onAddWord={vi.fn()}
      />,
    );

    fireEvent.click(screen.getAllByTitle('View Note')[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'View 3 details' })[0]);
    fireEvent.click(screen.getByTitle('Edit Note'));
    fireEvent.click(screen.getByTitle('Remove Word'));

    expect(onViewNote).toHaveBeenCalledWith(wordCards[0]);
    expect(onViewDetails).toHaveBeenCalledWith(wordNote);
    expect(onEditWord).toHaveBeenCalledWith(wordCards[0]);
    expect(onRemoveWord).toHaveBeenCalledWith(wordCards[0]);
  });
});

describe('CardList Component - Virtualization & Large Decks', () => {
  it('only renders a virtualized slice of DOM rows for a 1,000-card deck and updates on filter', () => {
    const largeDeckCards: Card[] = Array.from({ length: 1000 }, (_, i) => ({
      id: `card-large-${i}`,
      note_id: `note-large-${i}`,
      template_key: 'front-back',
      active: true,
      front: i === 999 ? 'UniqueTargetFront' : `Card Front ${i}`,
      back: i === 999 ? 'UniqueTargetBack' : `Card Back ${i}`,
      due_at: Date.now(),
      scheduled_interval_minutes: 0,
      created_at: Date.now(),
      updated_at: Date.now(),
    }));

    render(
      <CardList
        cards={largeDeckCards}
        onEditCard={vi.fn()}
        onRemoveFromDeck={vi.fn()}
        onAddCard={vi.fn()}
        canEditCard={() => true}
      />,
    );

    // Verify catalog title reflects total count of 1,000
    expect(screen.getByText('1000 Cards')).toBeInTheDocument();

    // Verify virtualization: DOM contains far fewer row elements than 1,000 (only windowed slice)
    const renderedRows = screen.getAllByRole('row');
    // Header row + windowed items (<= 20)
    expect(renderedRows.length).toBeLessThan(25);
    expect(screen.getByText('Card Front 0')).toBeInTheDocument();
    expect(screen.queryByText('UniqueTargetFront')).not.toBeInTheDocument();

    // Filter down to the unique target card
    const searchInput = screen.getByPlaceholderText('Search front, back...');
    fireEvent.change(searchInput, { target: { value: 'UniqueTargetFront' } });

    // Verify search correctly narrows catalog to 1 card and renders it
    expect(screen.getByText('1 Cards')).toBeInTheDocument();
    expect(screen.getByText('UniqueTargetFront')).toBeInTheDocument();
  });

  it('simulates rendering an off-screen slice in the virtualized list (scrolling)', async () => {
    // Mock dimensions so the virtualizer knows the viewport size
    const originalGetBoundingClientRect =
      Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 800,
      height: 800,
      top: 0,
      left: 0,
      bottom: 800,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));

    const originalClientHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientHeight',
    );
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      value: 800,
    });

    const largeDeckCards: Card[] = Array.from({ length: 1000 }, (_, i) => ({
      id: `card-large-${i}`,
      note_id: `note-large-${i}`,
      template_key: 'front-back',
      active: true,
      front: `Card Front ${i}`,
      back: `Card Back ${i}`,
      due_at: Date.now(),
      scheduled_interval_minutes: 0,
      created_at: Date.now(),
      updated_at: Date.now(),
    }));

    const listRef = { current: null as CardListRef | null };

    render(
      <CardList
        ref={listRef}
        cards={largeDeckCards}
        onEditCard={vi.fn()}
        onRemoveFromDeck={vi.fn()}
        onAddCard={vi.fn()}
        canEditCard={() => true}
      />,
    );

    // Initially, item 500 should NOT be in the document
    expect(screen.queryByText('Card Front 500')).not.toBeInTheDocument();

    // Programmatically scroll to item 500 using the exposed ref
    vi.useFakeTimers();
    act(() => {
      listRef.current?.scrollToIndex(500);
      vi.runAllTimers();
    });
    vi.useRealTimers();

    // Wait for the virtualizer to process the scroll offset and update the DOM
    await waitFor(() => {
      // Verify virtualization rendered the slice containing item 500
      expect(screen.getByText('Card Front 500')).toBeInTheDocument();
    });

    // Ensure item 0 is NOT rendered (since it's virtualized out of the viewport)
    expect(screen.queryByText('Card Front 0')).not.toBeInTheDocument();

    // Cleanup
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    if (originalClientHeight) {
      Object.defineProperty(
        HTMLElement.prototype,
        'clientHeight',
        originalClientHeight,
      );
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
    }
  });

  it('calls rowVirtualizer.measure() when window.matchMedia fires a change event', () => {
    render(
      <CardList
        cards={[]}
        onEditCard={vi.fn()}
        onRemoveFromDeck={vi.fn()}
        canEditCard={() => true}
        onAddCard={vi.fn()}
      />,
    );

    const matchMediaMock = vi.mocked(window.matchMedia);
    const mediaQueryList =
      matchMediaMock.mock.results[matchMediaMock.mock.results.length - 1].value;
    const addEventListenerMock = mediaQueryList.addEventListener;

    const listener = addEventListenerMock.mock.calls[0][1];
    const virtualizerInstance =
      vi.mocked(useVirtualizer).mock.results[
        vi.mocked(useVirtualizer).mock.results.length - 1
      ].value;

    listener();
    expect(virtualizerInstance.measure).toHaveBeenCalled();
  });
});
