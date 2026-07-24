import { useState } from "react";
import { Card } from "@/hooks/useMockStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card as UICard, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Search, Edit, Trash2, Library, HelpCircle } from "lucide-react";

interface CardListProps {
  cards: Card[];
  onEditCard: (card: Card) => void;
  onDeleteCard: (cardId: string) => void;
}

export function CardList({ cards, onEditCard, onDeleteCard }: CardListProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredCards = cards.filter(
    (c) =>
      c.front.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.back.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.notes && c.notes.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
            placeholder="Search front, back, notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filteredCards.length === 0 ? (
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
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredCards.map((card) => (
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
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground"
                          onClick={() => onEditCard(card)}
                        >
                          <Edit className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 rounded-lg cursor-pointer text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => onDeleteCard(card.id)}
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
  );
}
