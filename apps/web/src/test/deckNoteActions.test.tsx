import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DeckDetail } from '@/components/deck/DeckDetail';

const store = vi.hoisted(() => {
  const card = {
    id: 'card-1',
    note_id: 'note-1',
    template_key: 'front-back',
    active: true,
    front: 'front',
    back: 'back',
    due_at: 0,
    scheduled_interval_minutes: 0,
    created_at: 0,
    updated_at: 0,
  };
  return {
    card,
    isTakenOver: false,
    ready: true,
    showSpinner: false,
    decks: [
      {
        id: 'deck-1',
        title: 'Deck One',
        description: null,
        note_type: 'basic',
        native_language_id: null as string | null,
        target_language_id: null as string | null,
        created_at: 0,
        updated_at: 0,
      },
    ],
    getCardsForDeck: vi.fn(() => [card]),
    isBasicCard: vi.fn(() => true),
    isWordCard: vi.fn(() => false),
    noteForCard: vi.fn(),
    createCard: vi.fn(),
    createNote: vi.fn(),
    updateCard: vi.fn(),
    updateNoteFields: vi.fn(),
    removeNoteFromDeck: vi.fn(),
    error: null,
  };
});

vi.mock('@/hooks/useStore', () => ({
  useStore: () => store,
}));

describe('deck note actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.decks[0].note_type = 'basic';
    store.decks[0].native_language_id = null;
    store.decks[0].target_language_id = null;
    store.isBasicCard.mockReturnValue(true);
    store.isWordCard.mockReturnValue(false);
    store.removeNoteFromDeck.mockResolvedValue(undefined);
    store.updateNoteFields.mockResolvedValue(undefined);
  });

  it('explains and performs a membership-only removal', async () => {
    render(<DeckDetail deckId="deck-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTitle('Remove from Deck'));

    expect(screen.getByText('Remove Note from Deck?')).toBeInTheDocument();
    expect(
      screen.getByText(/note, its cards, schedule, and review history/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/permanently delete/i)).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByText('Remove from Deck', { selector: 'button' }),
    );

    await waitFor(() =>
      expect(store.removeNoteFromDeck).toHaveBeenCalledWith('note-1', 'deck-1'),
    );
  });

  it('does not offer the basic editor for a structured note card', () => {
    store.isBasicCard.mockReturnValue(false);

    render(<DeckDetail deckId="deck-1" onBack={vi.fn()} />);

    expect(screen.queryByTitle('Edit Card')).not.toBeInTheDocument();
    expect(screen.getByTitle('Remove from Deck')).toBeInTheDocument();
  });

  it('edits a word note and preserves its canonical languages and media', async () => {
    store.decks[0].note_type = 'word';
    store.decks[0].native_language_id = 'deck-native';
    store.decks[0].target_language_id = 'deck-target';
    store.isWordCard.mockReturnValue(true);
    store.noteForCard.mockReturnValue({
      id: 'note-1',
      note_type: 'word',
      fields_version: 1,
      fields_json: JSON.stringify({
        word: 'Hund',
        translation: 'dog',
        native_language_id: 'note-native',
        target_language_id: 'note-target',
        image: 'image-1',
        word_audio: 'audio-1',
      }),
    });

    render(<DeckDetail deckId="deck-1" onBack={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Edit Card'));
    fireEvent.change(screen.getByLabelText(/^word$/i), {
      target: { value: 'Hunde' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(store.updateNoteFields).toHaveBeenCalledWith('note-1', {
        word: 'Hunde',
        translation: 'dog',
        native_language_id: 'note-native',
        target_language_id: 'note-target',
        image: 'image-1',
        word_audio: 'audio-1',
      }),
    );
  });

  it('keeps an unknown deck type read-only', () => {
    store.decks[0].note_type = 'cloze';

    render(<DeckDetail deckId="deck-1" onBack={vi.fn()} />);

    expect(screen.getByText(/cannot edit yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add card/i })).toBeNull();
    expect(screen.queryByTitle('Edit Card')).toBeNull();
    expect(screen.queryByTitle('Remove from Deck')).toBeNull();
  });
});
