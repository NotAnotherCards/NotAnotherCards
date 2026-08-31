import { useState } from 'react';
import { useStore, Card } from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import {
  Card as UICard,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  Plus,
  RefreshCw,
  Unlink,
} from 'lucide-react';
import { CardForm } from './CardForm';
import { CardList } from './CardList';
import { writeErrorMessage } from '@/lib/write-error';
import { FormErrorMessage } from '@/components/auth/form-error-message';

interface DeckDetailProps {
  deckId: string;
  onBack: () => void;
}

export function DeckDetail({ deckId, onBack }: DeckDetailProps) {
  const store = useStore();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [noteToRemove, setNoteToRemove] = useState<Card | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  if (store.isTakenOver) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="cursor-pointer gap-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Decks
        </Button>
        <UICard className="border border-amber-500/30 bg-amber-500/10 p-8 flex flex-col items-center justify-center text-center space-y-4">
          <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
            <AlertCircle className="size-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-amber-900 dark:text-amber-200">
              Database Inactive (Taken Over)
            </h3>
            <p className="text-sm text-amber-800/80 dark:text-amber-300/80 mt-1 max-w-md">
              This tab is currently inactive because the offline database is
              open in another tab. Click below to use the database in this
              window.
            </p>
          </div>
          <Button
            onClick={() => window.location.reload()}
            className="cursor-pointer gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-medium border-none shadow-sm"
          >
            <RefreshCw className="size-4" />
            Use here instead
          </Button>
        </UICard>
      </div>
    );
  }

  if (!store.ready) {
    if (store.showSpinner) {
      return (
        <div className="flex flex-col items-center justify-center min-h-80 space-y-4 animate-in fade-in duration-300">
          <Loader2 className="animate-spin size-8 text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">
            Loading deck details...
          </p>
        </div>
      );
    }
    return null;
  }

  const deck = store.decks.find((d) => d.id === deckId);

  if (!deck) {
    return (
      <div className="text-center p-8">
        <p className="text-destructive font-semibold">Deck not found.</p>
        <Button onClick={onBack} className="mt-4 cursor-pointer">
          <ArrowLeft className="size-4 mr-2" /> Back to Decks
        </Button>
      </div>
    );
  }

  const cards = store.getCardsForDeck(deckId);

  // the dialog is dismissed only once the write lands, so a failed write is
  // never reported to the user as a success
  const handleCreateCard = async (data: { front: string; back: string }) => {
    setWriteError(null);
    try {
      await store.createCard(deckId, data.front, data.back);
      setShowCreateForm(false);
    } catch (err) {
      setWriteError(writeErrorMessage(err, 'Failed to create card'));
    }
  };

  const handleEditCard = async (data: { front: string; back: string }) => {
    if (!editingCard) return;
    setWriteError(null);
    try {
      await store.updateCard(editingCard.id, data.front, data.back);
      setEditingCard(null);
    } catch (err) {
      setWriteError(writeErrorMessage(err, 'Failed to update card'));
    }
  };

  const handleRemoveFromDeck = async () => {
    if (!noteToRemove) return;
    setIsRemoving(true);
    setWriteError(null);
    try {
      await store.removeNoteFromDeck(noteToRemove.note_id, deckId);
      setNoteToRemove(null);
    } catch (err) {
      setWriteError(writeErrorMessage(err, 'Failed to remove note from deck'));
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Detail Header & Action Buttons */}
      <div className="flex flex-col gap-4 bg-muted/20 p-5 rounded-3xl border border-border/40">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="cursor-pointer gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Decks
          </Button>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground font-heading">
              {deck.title}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              {deck.description || 'Manage your library cards below.'}
            </p>
          </div>
          <Button
            onClick={() => setShowCreateForm(true)}
            className="cursor-pointer gap-1.5 self-stretch md:self-auto justify-center"
          >
            <Plus className="size-4" />
            Add Card
          </Button>
        </div>
      </div>

      {/* Library View (Search & Card Table via CardList) */}
      <CardList
        cards={cards}
        onEditCard={(card) => setEditingCard(card)}
        onRemoveFromDeck={(card) => setNoteToRemove(card)}
        canEditCard={store.isBasicCard}
        onAddCard={() => setShowCreateForm(true)}
        isLoading={!store.ready}
        error={store.error}
      />

      {/* Add Card Form */}
      {showCreateForm && (
        <CardForm
          title="Add New Card"
          onSubmit={handleCreateCard}
          error={writeError}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Edit Card Form */}
      {editingCard && (
        <CardForm
          title="Edit Card"
          initialData={{
            front: editingCard.front,
            back: editingCard.back,
          }}
          onSubmit={handleEditCard}
          error={writeError}
          onCancel={() => setEditingCard(null)}
        />
      )}

      {/* Remove Note Membership Confirmation */}
      {noteToRemove && (
        <div
          onClick={() => setNoteToRemove(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
        >
          <UICard
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm border border-destructive/20 shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <CardHeader>
              <CardTitle className="text-lg font-bold text-destructive flex items-center gap-2">
                <Unlink className="size-5" />
                Remove Note from Deck?
              </CardTitle>
              <CardDescription>
                This removes every study card generated from this note from “
                {deck.title}”. The note, its cards, schedule, and review history
                will remain in your personal dictionary.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <FormErrorMessage message={writeError} className="mb-4" />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setNoteToRemove(null)}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleRemoveFromDeck}
                  disabled={isRemoving}
                  className="cursor-pointer"
                >
                  Remove from Deck
                </Button>
              </div>
            </CardContent>
          </UICard>
        </div>
      )}
    </div>
  );
}
