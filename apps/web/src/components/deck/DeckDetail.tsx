import { useState } from "react";
import { useMockStore, Card } from "@/hooks/useMockStore";
import { Button } from "@/components/ui/button";
import { Card as UICard, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Plus,
  Trash2,
} from "lucide-react";
import { CardForm } from "./CardForm";
import { CardList } from "./CardList";

interface DeckDetailProps {
  deckId: string;
  onBack: () => void;
}

export function DeckDetail({ deckId, onBack }: DeckDetailProps) {
  const store = useMockStore();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);

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

  // Filter cards belonging to this deck
  const cards = store.cards.filter((c) => c.collection_id === deckId);

  const handleCreateCard = (data: { lemma: string; translation: string; notes?: string }) => {
    store.createCard(deckId, data.lemma, data.translation, data.notes);
    setShowCreateForm(false);
  };

  const handleEditCard = (data: { lemma: string; translation: string; notes?: string }) => {
    if (editingCard) {
      store.updateCard(editingCard.id, data.lemma, data.translation, data.notes);
      setEditingCard(null);
    }
  };

  const handleDeleteCard = () => {
    if (cardToDelete) {
      store.deleteCard(cardToDelete);
      setCardToDelete(null);
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
              {deck.name}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              {deck.description || "Manage your library cards below."}
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
        onDeleteCard={(cardId) => setCardToDelete(cardId)}
        isLoading={store.isLoading}
        error={store.error}
      />

      {/* Add Card Form */}
      {showCreateForm && (
        <CardForm
          title="Add New Card"
          onSubmit={handleCreateCard}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Edit Card Form */}
      {editingCard && (
        <CardForm
          title="Edit Card"
          initialData={{
            lemma: editingCard.lemma,
            translation: editingCard.translation,
            notes: editingCard.notes,
          }}
          onSubmit={handleEditCard}
          onCancel={() => setEditingCard(null)}
        />
      )}

      {/* Delete Card Confirmation */}
      {cardToDelete && (
        <div
          onClick={() => setCardToDelete(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
        >
          <UICard
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm border border-destructive/20 shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <CardHeader>
              <CardTitle className="text-lg font-bold text-destructive flex items-center gap-2">
                <Trash2 className="size-5" />
                Delete Card?
              </CardTitle>
              <CardDescription>
                Are you sure you want to permanently delete this study card from your deck?
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-end gap-2 pt-0">
              <Button
                variant="outline"
                onClick={() => setCardToDelete(null)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteCard}
                className="cursor-pointer"
              >
                Delete
              </Button>
            </CardContent>
          </UICard>
        </div>
      )}
    </div>
  );
}
