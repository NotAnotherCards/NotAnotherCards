import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { DeckList } from '../components/deck/DeckList';
import type { Deck } from '../hooks/useStore';

// The store's write methods are async and reject on failure (a closed
// database, a failed write underneath). The deck views call them
// fire-and-forget and dismiss the dialog on the next line, so a rejection is
// dropped and the user is told the write succeeded when it did not.
//
// These tests pin the contract: the dialog closes on success and stays open
// on failure. They say nothing about how the error is surfaced, which is a
// UI decision left open.

const createDeck = vi.fn();
const updateDeck = vi.fn();
const deleteDeck = vi.fn();
const deleteDeckWithNotes = vi.fn();
const deckDeletionSummary = vi.fn();

const existingDeck: Deck = {
  id: 'deck-1',
  title: 'Spanish Verbs',
  description: 'Conversational verbs',
  visibility: 'private',
  note_type: 'basic',
  native_language_id: null,
  target_language_id: null,
  created_at: Date.now(),
  updated_at: Date.now(),
};

let decks: Deck[] = [];

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
    ready: true,
    decks,
    getCardsCount: () => 0,
    isLoading: false,
    isTakenOver: false,
    error: null,
    createDeck,
    updateDeck,
    deleteDeck,
    deleteDeckWithNotes,
    deckDeletionSummary,
  }),
}));

const saveButton = () => screen.queryByRole('button', { name: /save/i });
const confirmDeleteButton = () =>
  screen.queryByRole('button', { name: /delete deck only/i });

const fillTitleAndSubmit = (title: string) => {
  fireEvent.change(screen.getByLabelText(/title/i), {
    target: { value: title },
  });
  fireEvent.submit(saveButton()!.closest('form')!);
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('deck CRUD error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deckDeletionSummary.mockResolvedValue({
      orphanedNoteIds: ['note-1'],
      sharedNoteCount: 1,
      orphanedCardCount: 3,
      sharedCardCount: 2,
    });
    deleteDeckWithNotes.mockResolvedValue(undefined);
    decks = [];
  });

  describe('create', () => {
    const openForm = () =>
      fireEvent.click(
        screen.getByRole('button', { name: /create first deck/i }),
      );

    it('closes the dialog once the write succeeds', async () => {
      createDeck.mockResolvedValue({ id: 'deck-1' });

      render(<DeckList onSelectDeck={vi.fn()} onStartReview={vi.fn()} />);
      openForm();
      fillTitleAndSubmit('Spanish Verbs');

      await waitFor(() => expect(saveButton()).not.toBeInTheDocument());
    });

    it('keeps the dialog open when the write fails', async () => {
      createDeck.mockRejectedValue(new Error('database not initialized'));

      render(<DeckList onSelectDeck={vi.fn()} onStartReview={vi.fn()} />);
      openForm();
      fillTitleAndSubmit('Spanish Verbs');

      await waitFor(() => expect(createDeck).toHaveBeenCalledTimes(1));
      await flush();

      expect(saveButton()).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(
        'database not initialized',
      );
    });
  });

  describe('edit', () => {
    const openForm = () => {
      decks = [existingDeck];
      render(<DeckList onSelectDeck={vi.fn()} onStartReview={vi.fn()} />);
      fireEvent.click(screen.getByTitle('Edit'));
    };

    it('keeps the dialog open when the write fails', async () => {
      updateDeck.mockRejectedValue(new Error('database not initialized'));

      openForm();
      fillTitleAndSubmit('Spanish Verbs Revised');

      await waitFor(() => expect(updateDeck).toHaveBeenCalledTimes(1));
      await flush();

      expect(saveButton()).toBeInTheDocument();
    });
  });

  describe('delete', () => {
    const openDelete = () => {
      decks = [existingDeck];
      render(<DeckList onSelectDeck={vi.fn()} onStartReview={vi.fn()} />);
      fireEvent.click(screen.getByTitle('Delete'));
    };

    it.each([0, 1])(
      'uses singular wording and handles %i shared cards',
      async (sharedCardCount) => {
        deckDeletionSummary.mockResolvedValueOnce({
          orphanedNoteIds: ['note-1'],
          sharedNoteCount: sharedCardCount,
          orphanedCardCount: 1,
          sharedCardCount,
        });
        openDelete();
        const button = await screen.findByRole('button', {
          name: /Delete deck and 1 card/,
        });
        expect(
          screen.getByText(/1 card is only in this deck/),
        ).toBeInTheDocument();
        if (sharedCardCount === 0)
          expect(
            screen.queryByText(/also in other decks/),
          ).not.toBeInTheDocument();
        else
          expect(
            screen.getByText(/1 card is also in other decks/),
          ).toBeInTheDocument();
        fireEvent.click(button);
        expect(screen.getByRole('dialog')).toHaveAccessibleName(
          'Delete 1 card and its review history?',
        );
      },
    );

    it('shows card counts and requires a second confirmation', async () => {
      openDelete();
      const destructive = await screen.findByRole('button', {
        name: /Delete deck and 3 card/,
      });
      expect(
        screen.getByText(/2 cards are also in other decks/),
      ).toBeInTheDocument();
      fireEvent.click(destructive);
      expect(screen.getByRole('dialog')).toHaveAccessibleName(
        'Delete 3 cards and their review history?',
      );
      expect(deleteDeckWithNotes).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      expect(deleteDeckWithNotes).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole('button', { name: /Delete deck and 3 card/ }),
      );
      const dialog = screen.getByRole('dialog');
      const dialogButton = Array.from(dialog.querySelectorAll('button')).find(
        (b) => b.textContent === 'Delete',
      );
      if (dialogButton) fireEvent.click(dialogButton);
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
      expect(deleteDeckWithNotes).toHaveBeenCalledExactlyOnceWith('deck-1');
      expect(deleteDeck).not.toHaveBeenCalled();
    });

    it('keeps the second confirmation open on failure and allows retry', async () => {
      deleteDeckWithNotes.mockRejectedValueOnce(new Error('Deletion failed'));
      openDelete();
      fireEvent.click(
        await screen.findByRole('button', { name: /Delete deck and 3 card/ }),
      );
      const dialog = screen.getByRole('dialog');
      let dialogButton = Array.from(dialog.querySelectorAll('button')).find(
        (b) => b.textContent === 'Delete',
      );
      if (dialogButton) fireEvent.click(dialogButton);
      await screen.findByRole('alert');
      expect(screen.getByRole('alert')).toHaveTextContent('Deletion failed');
      dialogButton = Array.from(dialog.querySelectorAll('button')).find(
        (b) => b.textContent === 'Delete',
      );
      if (dialogButton) fireEvent.click(dialogButton);
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
      expect(deleteDeckWithNotes).toHaveBeenCalledTimes(2);
    });

    it('does not dismiss or submit twice while deletion is pending', async () => {
      let resolve!: () => void;
      deleteDeckWithNotes.mockReturnValueOnce(
        new Promise<void>((done) => {
          resolve = done;
        }),
      );
      openDelete();
      fireEvent.click(
        await screen.findByRole('button', { name: /Delete deck and 3 card/ }),
      );
      const dialog = screen.getByRole('dialog');
      const button = Array.from(dialog.querySelectorAll('button')).find(
        (b) => b.textContent === 'Delete',
      ) as HTMLElement;
      fireEvent.click(button);
      expect(button).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
      fireEvent.click(button);
      fireEvent.click(screen.getByRole('dialog').parentElement!);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(deleteDeckWithNotes).toHaveBeenCalledTimes(1);
      resolve();
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
    });

    it('deletes only the deck without a second confirmation', async () => {
      deleteDeck.mockResolvedValueOnce(undefined);
      openDelete();
      fireEvent.click(confirmDeleteButton()!);
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
      expect(deleteDeck).toHaveBeenCalledExactlyOnceWith('deck-1');
      expect(deleteDeckWithNotes).not.toHaveBeenCalled();
    });

    it('blocks card deletion when counts fail and allows cancellation', async () => {
      deckDeletionSummary.mockRejectedValueOnce(new Error('Count failed'));
      openDelete();
      expect(
        screen.getByRole('button', { name: 'Delete deck and cards' }),
      ).toBeDisabled();
      await screen.findByRole('alert');
      expect(screen.getByRole('alert')).toHaveTextContent('Count failed');
      expect(
        screen.getByRole('button', { name: 'Delete deck and cards' }),
      ).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(deleteDeckWithNotes).not.toHaveBeenCalled();
    });

    it('keeps the confirmation open when the write fails', async () => {
      deleteDeck.mockRejectedValue(new Error('database not initialized'));
      decks = [existingDeck];

      render(<DeckList onSelectDeck={vi.fn()} onStartReview={vi.fn()} />);
      fireEvent.click(screen.getByTitle('Delete'));
      fireEvent.click(confirmDeleteButton()!);

      await waitFor(() => expect(deleteDeck).toHaveBeenCalledTimes(1));
      await flush();

      expect(confirmDeleteButton()).toBeInTheDocument();
    });
  });
});
