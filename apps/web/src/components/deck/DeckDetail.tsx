import { useState } from "react";
import { useMockStore, Card } from "@/hooks/useMockStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card as UICard, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Plus,
  Search,
  Edit,
  Trash2,
  Calendar,
  HelpCircle,
} from "lucide-react";
import { CardForm } from "./CardForm";

interface DeckDetailProps {
  deckId: string;
  onBack: () => void;
}

export function DeckDetail({ deckId, onBack }: DeckDetailProps) {
  const store = useMockStore();
  const [searchTerm, setSearchTerm] = useState("");
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

  // Filter cards belonging to this deck by search term
  const cards = store.cards.filter(
    (c) =>
      c.deckId === deckId &&
      (c.front.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.back.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.notes && c.notes.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  const handleCreateCard = (data: { front: string; back: string; notes?: string }) => {
    store.createCard(deckId, data.front, data.back, data.notes);
    setShowCreateForm(false);
  };

  const handleEditCard = (data: { front: string; back: string; notes?: string }) => {
    if (editingCard) {
      store.updateCard(editingCard.id, data.front, data.back, data.notes);
      setEditingCard(null);
    }
  };

  const handleDeleteCard = () => {
    if (cardToDelete) {
      store.deleteCard(cardToDelete);
      setCardToDelete(null);
    }
  };

  const formatDueDate = (isoString: string) => {
    const due = new Date(isoString);
    const now = new Date();
    
    if (due <= now) {
      return (
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          Due Now
        </span>
      );
    }

    // Format clean relative/absolute date
    const diffMs = due.getTime() - now.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 24) {
      return <span className="text-muted-foreground">In {diffHours}h</span>;
    }
    
    const diffDays = Math.round(diffHours / 24);
    if (diffDays === 1) {
      return <span className="text-muted-foreground">Tomorrow</span>;
    }
    
    return (
      <span className="text-muted-foreground">
        {due.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </span>
    );
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

      {/* Library View (Search & Card Table) */}
      <UICard className="border border-border/60">
        <CardHeader className="border-b border-border/40 pb-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-md font-bold flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              Card Catalog ({cards.length})
            </CardTitle>
          </div>
          {/* Search bar */}
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search front, back, notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {cards.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground min-h-50">
              <HelpCircle className="size-10 mb-2 stroke-1 opacity-60" />
              <p className="text-sm font-semibold">No Cards Found</p>
              <p className="text-xs max-w-xs mt-1">
                {searchTerm
                  ? "Try refining your search term to find cards in this deck."
                  : "This deck is empty. Click 'Add Card' above to start building your collection."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20 text-xs font-semibold text-muted-foreground">
                    <th className="px-6 py-3 min-w-50">Front Side</th>
                    <th className="px-6 py-3 min-w-50">Back Side</th>
                    <th className="px-6 py-3 hidden md:table-cell">Notes</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-center">Interval</th>
                    <th className="px-6 py-3">Next Due</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {cards.map((card) => (
                    <tr key={card.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4 font-medium max-w-62.5 truncate" title={card.front}>
                        {card.front}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground max-w-62.5 truncate" title={card.back}>
                        {card.back}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs max-w-50 truncate hidden md:table-cell" title={card.notes}>
                        {card.notes || "-"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          card.status === "new"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : card.status === "learning"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                        }`}>
                          {card.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-xs font-semibold text-muted-foreground">
                        {card.interval === 0 ? "Same day" : `${card.interval}d`}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {formatDueDate(card.dueAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground"
                            onClick={() => setEditingCard(card)}
                          >
                            <Edit className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 rounded-lg cursor-pointer text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setCardToDelete(card.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </UICard>

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
            front: editingCard.front,
            back: editingCard.back,
            notes: editingCard.notes,
          }}
          onSubmit={handleEditCard}
          onCancel={() => setEditingCard(null)}
        />
      )}

      {/* Delete Card Confirmation */}
      {cardToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <UICard className="w-full max-w-sm border border-destructive/20 shadow-2xl animate-in zoom-in-95 duration-200">
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
