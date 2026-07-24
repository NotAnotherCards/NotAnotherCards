import { useState } from "react";
import { useMockStore, Deck } from "@/hooks/useMockStore";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Plus, Play, FolderOpen, Edit, Trash2, Library, BookOpen } from "lucide-react";
import { DeckForm } from "./DeckForm";

interface DeckListProps {
  onSelectDeck: (deckId: string) => void;
  onStartStudy: (deckId: string) => void;
}

export function DeckList({ onSelectDeck, onStartStudy }: DeckListProps) {
  const store = useMockStore();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [deckToDelete, setDeckToDelete] = useState<string | null>(null);

  const handleCreateDeck = (data: { name: string; description: string }) => {
    store.createDeck(data.name, data.description);
    setShowCreateForm(false);
  };

  const handleEditDeck = (data: { name: string; description: string }) => {
    if (editingDeck) {
      store.updateDeck(editingDeck.id, data.name, data.description);
      setEditingDeck(null);
    }
  };

  const handleDeleteDeck = () => {
    if (deckToDelete) {
      store.deleteDeck(deckToDelete);
      setDeckToDelete(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/20 p-4 rounded-3xl border border-border/40">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary">
            <Library className="size-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground font-heading">Flashcard Library</h2>
            <p className="text-xs text-muted-foreground">
              Manage your custom card decks and review progress.
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
            Create your first deck to start adding learning materials and studying.
          </p>
          <Button onClick={() => setShowCreateForm(true)} className="cursor-pointer">
            Create First Deck
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {store.decks.map((deck) => {
            const counts = store.getCardsCountByStatus(deck.id);
            const dueCount = store.getDueCardsCount(deck.id);
            const totalCards = counts.newCount + counts.learningCount + counts.reviewCount;

            return (
              <Card
                key={deck.id}
                className="group border border-border/60 hover:border-primary/30 hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <CardTitle
                      className="text-base font-bold group-hover:text-primary transition-colors cursor-pointer truncate max-w-[80%]"
                      onClick={() => onSelectDeck(deck.id)}
                      title={deck.name}
                    >
                      {deck.name}
                    </CardTitle>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 rounded-lg cursor-pointer hover:bg-muted text-muted-foreground hover:text-foreground"
                        onClick={() => setEditingDeck(deck)}
                        title="Edit Deck Details"
                      >
                        <Edit className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 rounded-lg cursor-pointer hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeckToDelete(deck.id)}
                        title="Delete Deck"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="text-xs line-clamp-2 min-h-8 mt-1">
                    {deck.description || "No description provided."}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Card count tags */}
                  <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-muted/40 rounded-2xl border border-border/30 text-center">
                    <div>
                      <div className="text-xs text-muted-foreground font-medium">New</div>
                      <div className="text-sm font-bold text-blue-500">{counts.newCount}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground font-medium">Learn</div>
                      <div className="text-sm font-bold text-amber-500">{counts.learningCount}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground font-medium">Due</div>
                      <div className="text-sm font-bold text-emerald-500">{dueCount}</div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => onStartStudy(deck.id)}
                      disabled={dueCount === 0}
                      className="flex-1 cursor-pointer gap-1.5 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white disabled:opacity-50"
                      size="sm"
                    >
                      <Play className="size-3.5 fill-current" />
                      Study ({dueCount})
                    </Button>
                    <Button
                      onClick={() => onSelectDeck(deck.id)}
                      variant="outline"
                      className="flex-1 cursor-pointer gap-1.5"
                      size="sm"
                    >
                      <FolderOpen className="size-3.5" />
                      Library ({totalCards})
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Deck Dialog */}
      {showCreateForm && (
        <DeckForm
          title="Create New Deck"
          onSubmit={handleCreateDeck}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Edit Deck Dialog */}
      {editingDeck && (
        <DeckForm
          title="Edit Deck Details"
          initialData={{ name: editingDeck.name, description: editingDeck.description }}
          onSubmit={handleEditDeck}
          onCancel={() => setEditingDeck(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deckToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-sm border border-destructive/20 shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-destructive flex items-center gap-2">
                <Trash2 className="size-5" />
                Delete Deck?
              </CardTitle>
              <CardDescription>
                This action is permanent. Deleting this deck will also permanently delete all cards inside it.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-end gap-2 pt-0">
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
                className="cursor-pointer"
              >
                Delete Permanently
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
