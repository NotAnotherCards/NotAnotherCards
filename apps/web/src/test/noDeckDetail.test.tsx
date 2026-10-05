import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoDeckDetail } from '@/components/deck/NoDeckDetail';

const store = vi.hoisted(() => {
  const card = {
    id: 'orphan-card',
    note_id: 'orphan-note',
    template_key: 'front-back',
    active: true,
    front: 'Question',
    back: 'Answer',
    due_at: 0,
    scheduled_interval_minutes: 0,
    created_at: 0,
    updated_at: 0,
  };
  return {
    card,
    ready: true,
    getCardsWithoutDeck: vi.fn(() => [card]),
    isBasicCard: vi.fn(() => true),
    isWordCard: vi.fn(() => false),
    notes: [] as Array<{
      id: string;
      note_type: string;
      fields_version: number;
      fields_json: string;
    }>,
    noteForCard: vi.fn(() => null),
    updateCard: vi.fn(),
    updateNoteFields: vi.fn(),
    deleteNote: vi.fn(),
    deleteNotes: vi.fn(),
  };
});

vi.mock('@/hooks/useStore', () => ({
  useStore: () => store,
}));

vi.mock('@/components/deck/WordNoteList', () => ({
  WordNoteList: ({
    basicCards,
    notes,
    onRemoveCard,
  }: {
    basicCards: Array<typeof store.card>;
    notes: Array<{ id: string }>;
    onRemoveCard: (card: typeof store.card) => void;
  }) => (
    <div>
      {basicCards.map((card) => (
        <button key={card.id} type="button" onClick={() => onRemoveCard(card)}>
          Delete {card.front}
        </button>
      ))}
      {notes.map((note) => (
        <p key={note.id}>Unknown note {note.id}</p>
      ))}
    </div>
  ),
}));

vi.mock('@/components/deck/CardForm', () => ({
  CardForm: () => null,
}));

vi.mock('@/components/deck/WordNoteForm', () => ({
  WordNoteForm: () => null,
}));

describe('NoDeckDetail', () => {
  beforeEach(() => {
    store.getCardsWithoutDeck.mockReturnValue([store.card]);
    store.isBasicCard.mockReturnValue(true);
    store.isWordCard.mockReturnValue(false);
    store.notes = [];
    store.deleteNote.mockReset();
    store.deleteNotes.mockReset();
  });

  it('deletes an orphan note instead of attempting to remove a missing membership', async () => {
    store.deleteNote.mockResolvedValue(undefined);
    const onBack = vi.fn();
    render(<NoDeckDetail onBack={onBack} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Question' }));
    expect(screen.getByText('Delete card?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(store.deleteNote).toHaveBeenCalledWith('orphan-note'),
    );
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('closes the delete dialog with Escape and returns focus to its trigger', () => {
    render(<NoDeckDetail onBack={vi.fn()} />);

    const deleteButton = screen.getByRole('button', {
      name: 'Delete Question',
    });
    deleteButton.focus();
    fireEvent.click(deleteButton);
    expect(screen.getByText('Delete card?')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByText('Delete card?')).not.toBeInTheDocument();
    expect(deleteButton).toHaveFocus();
  });

  it('keeps a note with unsupported fields in the no-deck list', () => {
    const unsupportedCard = {
      ...store.card,
      id: 'future-card',
      note_id: 'future-note',
    };
    store.getCardsWithoutDeck.mockReturnValue([unsupportedCard]);
    store.isBasicCard.mockReturnValue(false);
    store.isWordCard.mockReturnValue(false);
    store.notes = [
      {
        id: 'future-note',
        note_type: 'future-note-type',
        fields_version: 99,
        fields_json: '{}',
      },
    ];

    render(<NoDeckDetail onBack={vi.fn()} />);

    expect(screen.getByText('Unknown note future-note')).toBeInTheDocument();
  });

  it('does not delete all cards when the first confirmation is cancelled', () => {
    render(<NoDeckDetail onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete 1 card' }));
    expect(screen.getByText('Delete 1 card?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(store.deleteNotes).not.toHaveBeenCalled();
  });

  it('keeps the final confirmation open when deleting all cards fails', async () => {
    store.deleteNotes.mockRejectedValueOnce(new Error('Write failed'));
    render(<NoDeckDetail onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete 1 card' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(store.deleteNotes).toHaveBeenCalledWith(['orphan-note']),
    );
    expect(screen.getByText('Permanently delete 1 card?')).toBeInTheDocument();
    expect(screen.getByText('Write failed')).toBeInTheDocument();
  });
});
