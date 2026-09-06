import { Card } from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import { Edit, Unlink, Eye } from 'lucide-react';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';

interface CardItemProps {
  card: Card;
  onEditCard: (card: Card) => void;
  onRemoveFromDeck: (card: Card) => void;
  onViewCard: (card: Card) => void;
  canEdit?: boolean;
}

export function CardItem({
  card,
  onEditCard,
  onRemoveFromDeck,
  onViewCard,
  canEdit = true,
}: CardItemProps) {
  return (
    <tr className="hover:bg-muted/10 transition-colors">
      <td
        className="px-6 py-4 font-medium max-w-62.5 truncate"
        title={card.front}
      >
        <MarkdownRenderer content={card.front} inline />
      </td>
      <td
        className="px-6 py-4 text-muted-foreground max-w-62.5 truncate"
        title={card.back}
      >
        <MarkdownRenderer content={card.back} inline />
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs rounded-lg cursor-pointer text-muted-foreground hover:text-foreground gap-1"
            onClick={() => onViewCard(card)}
            title="View Card"
          >
            <Eye className="size-3.5" />
            View
          </Button>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={() => onEditCard(card)}
              title="Edit Card"
            >
              <Edit className="size-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-lg cursor-pointer text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => onRemoveFromDeck(card)}
            title="Remove from Deck"
          >
            <Unlink className="size-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
