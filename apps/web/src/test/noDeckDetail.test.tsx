import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
    notes: [],
    noteForCard: vi.fn(() => null),
    updateCard: vi.fn(),
    updateNoteFields: vi.fn(),
    deleteNote: vi.fn(),
  };
});

vi.mock('@/hooks/useStore', () => ({
  useStore: () => store,
}));

vi.mock('@/components/deck/WordNoteList', () => ({
  WordNoteList: ({
    basicCards,
    onRemoveCard,
  }: {
    basicCards: Array<typeof store.card>;
    onRemoveCard: (card: typeof store.card) => void;
  }) => (
    <div>
      <p>{basicCards[0].front}</p>
      <button type="button" onClick={() => onRemoveCard(basicCards[0])}>
        Delete orphan card
      </button>
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
  it('deletes an orphan note instead of attempting to remove a missing membership', async () => {
    store.deleteNote.mockResolvedValue(undefined);
    const onBack = vi.fn();
    render(<NoDeckDetail onBack={onBack} />);

    expect(screen.getByText('Question')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete orphan card' }));
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
      name: 'Delete orphan card',
    });
    deleteButton.focus();
    fireEvent.click(deleteButton);
    expect(screen.getByText('Delete card?')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByText('Delete card?')).not.toBeInTheDocument();
    expect(deleteButton).toHaveFocus();
  });
});
