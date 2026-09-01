import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { DeckCard } from '../components/deck/DeckCard';
import { CardItem } from '../components/deck/CardItem';
import { FlashcardModal } from '../components/deck/FlashcardModal';
import { Deck, Card } from '../hooks/useStore';

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
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  it('renders the deck title, description, and total cards badge', () => {
    render(
      <DeckCard
        deck={mockDeck}
        totalCards={12}
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

  it('calls action callbacks on click events', () => {
    const onSelectDeck = vi.fn();
    const onStartReview = vi.fn();
    const onEditDeck = vi.fn();
    const onDeleteDeck = vi.fn();

    render(
      <DeckCard
        deck={mockDeck}
        totalCards={12}
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
      <table>
        <tbody>
          <CardItem
            card={mockCard}
            onEditCard={vi.fn()}
            onRemoveFromDeck={vi.fn()}
            onViewCard={vi.fn()}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText('Hola')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('triggers callbacks on view, edit, and remove-from-deck actions', () => {
    const onEditCard = vi.fn();
    const onRemoveFromDeck = vi.fn();
    const onViewCard = vi.fn();

    render(
      <table>
        <tbody>
          <CardItem
            card={mockCard}
            onEditCard={onEditCard}
            onRemoveFromDeck={onRemoveFromDeck}
            onViewCard={onViewCard}
          />
        </tbody>
      </table>,
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
      <table>
        <tbody>
          <CardItem
            card={mockCard}
            onEditCard={vi.fn()}
            onRemoveFromDeck={vi.fn()}
            onViewCard={vi.fn()}
            canEdit={false}
          />
        </tbody>
      </table>,
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

  it('shows the multiplicative next interval for a reviewed card', async () => {
    render(
      <FlashcardModal
        card={{
          ...mockCard,
          scheduled_interval_minutes: 3 * 24 * 60,
        }}
        onClose={vi.fn()}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('flashcard-inner'));
    });

    expect(
      screen.getByRole('button', { name: 'Good (7.5d)' }),
    ).toBeInTheDocument();
  });
});
