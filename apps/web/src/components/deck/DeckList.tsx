import { useState } from "react";
import { useStore, Deck } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Plus,
  Library,
  BookOpen,
  AlertCircle,
  Loader2,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { DeckForm } from "./DeckForm";
import { DeckCard } from "./DeckCard";
import { writeErrorMessage } from "@/lib/write-error";
import { FormErrorMessage } from "@/components/auth/form-error-message";

interface DeckListProps {
  onSelectDeck: (deckId: string) => void;
}

export function DeckList({ onSelectDeck }: DeckListProps) {
  const store = useStore();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [deckToDelete, setDeckToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  // the dialog is dismissed only once the write lands, so a failed write is
  // never reported to the user as a success
  const handleCreateDeck = async (data: {
    title: string;
    description: string;
  }) => {
    setWriteError(null);
    try {
      await store.createDeck(data.title, data.description);
      setShowCreateForm(false);
    } catch (err) {
      setWriteError(writeErrorMessage(err, "Failed to create deck"));
    }
  };

  const handleEditDeck = async (data: {
    title: string;
    description: string;
  }) => {
    if (!editingDeck) return;
    setWriteError(null);
    try {
      await store.updateDeck(editingDeck.id, data.title, data.description);
      setEditingDeck(null);
    } catch (err) {
      setWriteError(writeErrorMessage(err, "Failed to update deck"));
    }
  };

  const handleDeleteDeck = async () => {
    if (!deckToDelete) return;
    setIsDeleting(true);
    setWriteError(null);
    try {
      await store.deleteDeck(deckToDelete);
      setDeckToDelete(null);
    } catch (err) {
      setWriteError(writeErrorMessage(err, "Failed to delete deck"));
    } finally {
      setIsDeleting(false);
    }
  };

  if (store.isTakenOver) {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-3xl border border-amber-500/30 bg-amber-500/10 text-center min-h-65 space-y-4 animate-in fade-in duration-200">
        <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
          <AlertCircle className="size-8" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-amber-900 dark:text-amber-200">
            Database Inactive (Taken Over)
          </h3>
          <p className="text-sm text-amber-800/80 dark:text-amber-300/80 mt-1 max-w-md">
            This tab is currently inactive because the offline database is open
            in another tab. Click below to use the database in this window.
          </p>
        </div>
        <Button
          onClick={() => window.location.reload()}
          className="cursor-pointer gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-medium border-none shadow-sm"
        >
          <RefreshCw className="size-4" />
          Use here instead
        </Button>
      </div>
    );
  }

  if (store.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-80 space-y-4 animate-in fade-in duration-300">
        <Loader2 className="animate-spin size-8 text-primary" />
        <p className="text-sm font-semibold text-foreground animate-pulse">
          Connecting Local Database...
        </p>
        <p className="text-xs text-muted-foreground">
          Initializing offline storage handles and loading library.
        </p>
      </div>
    );
  }

  if (store.error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-3xl border border-destructive/25 bg-destructive/5 text-center min-h-60 space-y-4 animate-in fade-in duration-200">
        <div className="p-3 rounded-2xl bg-destructive/10 text-destructive">
          <AlertCircle className="size-8" />
        </div>
        <div>
          <h3 className="text-base font-bold text-destructive">
            Failed to Load Decks
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {store.error ||
              "An error occurred while loading your library. Please try reloading."}
          </p>
        </div>
        <Button
          variant="outline"
          className="cursor-pointer gap-1.5"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="size-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/20 p-4 rounded-3xl border border-border/40">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary">
            <Library className="size-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground font-heading">
              My Library
            </h2>
            <p className="text-xs text-muted-foreground">
              Manage your custom card decks.
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="cursor-pointer gap-1.5 self-start sm:self-center"
        >
          <Plus className="size-4" />
          Create Deck
        </Button>
      </div>

      {/* Decks Grid */}
      {store.decks.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 rounded-3xl border border-dashed border-border/85 bg-muted/10 text-center min-h-75">
          <BookOpen className="size-12 text-muted-foreground/60 mb-4 stroke-1 animate-bounce" />
          <h3 className="text-lg font-semibold mb-1">No Decks Yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Create your first deck to start adding learning materials and
            studying.
          </p>
          <Button
            onClick={() => setShowCreateForm(true)}
            className="cursor-pointer"
          >
            Create First Deck
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {store.decks.map((deck) => {
            const totalCards = store.getCardsCount(deck.id);

            return (
              <DeckCard
                key={deck.id}
                deck={deck}
                totalCards={totalCards}
                onSelectDeck={onSelectDeck}
                onEditDeck={(d) => setEditingDeck(d)}
                onDeleteDeck={(id) => setDeckToDelete(id)}
              />
            );
          })}
        </div>
      )}

      {/* Create Deck Dialog */}
      {showCreateForm && (
        <DeckForm
          title="Create New Deck"
          onSubmit={handleCreateDeck}
          error={writeError}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Edit Deck Dialog */}
      {editingDeck && (
        <DeckForm
          title="Edit Deck Details"
          initialData={{
            title: editingDeck.title,
            description: editingDeck.description || "",
          }}
          onSubmit={handleEditDeck}
          error={writeError}
          onCancel={() => setEditingDeck(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deckToDelete && (
        <div
          onClick={() => setDeckToDelete(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
        >
          <Card
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm border border-destructive/20 shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <CardHeader>
              <CardTitle className="text-lg font-bold text-destructive flex items-center gap-2">
                <Trash2 className="size-5" />
                Delete Deck?
              </CardTitle>
              <CardDescription>
                This action is permanent. Deleting this deck will also
                permanently delete all cards inside it.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <FormErrorMessage message={writeError} className="mb-4" />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDeckToDelete(null)}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteDeck}
                  disabled={isDeleting}
                  className="cursor-pointer"
                >
                  Delete Permanently
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
