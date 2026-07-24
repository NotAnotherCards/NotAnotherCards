import { Card } from "@/hooks/useMockStore";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";

interface CardItemProps {
  card: Card;
  onEditCard: (card: Card) => void;
  onDeleteCard: (cardId: string) => void;
}

export function CardItem({ card, onEditCard, onDeleteCard }: CardItemProps) {
  return (
    <tr className="hover:bg-muted/10 transition-colors">
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
            title="Edit Card"
          >
            <Edit className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-lg cursor-pointer text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => onDeleteCard(card.id)}
            title="Delete Card"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
