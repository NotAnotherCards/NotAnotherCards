import { Deck } from "@/hooks/useMockStore";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Edit, Trash2, FolderOpen } from "lucide-react";

interface DeckCardProps {
  deck: Deck;
  totalCards: number;
  onSelectDeck: (deckId: string) => void;
  onEditDeck: (deck: Deck) => void;
  onDeleteDeck: (deckId: string) => void;
}

export function DeckCard({
  deck,
  totalCards,
  onSelectDeck,
  onEditDeck,
  onDeleteDeck,
}: DeckCardProps) {
  return (
    <Card className="group border border-border/60 hover:border-primary/30 hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
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
              onClick={() => onEditDeck(deck)}
              title="Edit Deck Details"
            >
              <Edit className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg cursor-pointer hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              onClick={() => onDeleteDeck(deck.id)}
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
        <div className="grid grid-cols-1 gap-2 py-2 px-3 bg-muted/40 rounded-2xl border border-border/30 text-center">
          <div>
            <div className="text-xs text-muted-foreground font-medium">
              Total Cards
            </div>
            <span className="text-sm font-bold text-foreground" data-testid="total-cards-badge">
              {totalCards}
            </span>
          </div>
        </div>

        <div className="flex pt-2">
          <Button
            onClick={() => onSelectDeck(deck.id)}
            className="w-full cursor-pointer gap-1.5"
            size="sm"
          >
            <FolderOpen className="size-3.5" />
            Manage Cards
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
