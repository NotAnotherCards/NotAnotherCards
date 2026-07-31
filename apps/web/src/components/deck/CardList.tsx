import { useState } from "react";
import { Card } from "@/hooks/useMockStore";
import { Input } from "@/components/ui/input";
import {
  Card as UICard,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Search,
  Library,
  HelpCircle,
  AlertCircle,
  Loader2,
  Plus,
} from "lucide-react";
import { CardItem } from "./CardItem";
import { FlashcardModal } from "./FlashcardModal";
import { Button } from "../ui/button";

interface CardListProps {
  cards: Card[];
  onEditCard: (card: Card) => void;
  onDeleteCard: (cardId: string) => void;
  onAddCard: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export function CardList({
  cards,
  onEditCard,
  onDeleteCard,
  onAddCard,
  isLoading,
  error,
}: CardListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewingCard, setViewingCard] = useState<Card | null>(null);

  const filteredCards = cards.filter(
    (c) =>
      c.front.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.back.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (isLoading) {
    return (
      <UICard className="border border-border/60">
        <CardContent className="flex flex-col items-center justify-center min-h-60 space-y-4 animate-in fade-in duration-300">
          <Loader2 className="animate-spin size-8 text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">
            Loading cards...
          </p>
        </CardContent>
      </UICard>
    );
  }

  if (error) {
    return (
      <UICard className="border border-border/60 p-6 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in duration-200">
        <div className="p-3 rounded-2xl bg-destructive/10 text-destructive">
          <AlertCircle className="size-8" />
        </div>
        <div>
          <h3 className="text-md font-bold text-destructive">
            Failed to Load Cards
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {error || "An error occurred while loading deck contents."}
          </p>
        </div>
      </UICard>
    );
  }

  return (
    <UICard className="border border-border/60">
      <CardHeader className="border-b border-border/40 pb-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-md font-bold flex items-center gap-2">
            <Library className="size-4 text-primary" />
            Card Catalog ({filteredCards.length})
          </CardTitle>
        </div>
        {/* Search bar */}
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search front, back..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filteredCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground min-h-50 gap-3">
            <HelpCircle className="size-10 mb-2 stroke-1 opacity-60" />
            <p className="text-sm font-semibold">No Cards Found</p>
            <p className="text-xs max-w-xs mt-1">
              {searchTerm
                ? "Try refining your search term to find cards in this deck."
                : "This deck is empty. Click 'Add Card' above to start building your collection."}
            </p>
            {!searchTerm && cards.length === 0 ? (
              <Button
                onClick={onAddCard}
                className="cursor-pointer gap-1.5 self-start sm:self-center"
              >
                <Plus className="size-4" />
                Add Card
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20 text-xs font-semibold text-muted-foreground">
                  <th className="px-6 py-3 min-w-50">Front / Question</th>
                  <th className="px-6 py-3 min-w-50">Back / Answer</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredCards.map((card) => (
                  <CardItem
                    key={card.id}
                    card={card}
                    onEditCard={onEditCard}
                    onDeleteCard={onDeleteCard}
                    onViewCard={(c) => setViewingCard(c)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {viewingCard && (
        <FlashcardModal
          cards={filteredCards}
          initialCardId={viewingCard.id}
          onClose={() => setViewingCard(null)}
        />
      )}
    </UICard>
  );
}
