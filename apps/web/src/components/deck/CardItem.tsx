import { forwardRef } from 'react';
import { Card } from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import { Edit, Unlink, Eye } from 'lucide-react';
import { WORD_TO_TRANSLATION_TEMPLATE_KEY } from '@repo/offline-db';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';

interface CardItemProps {
  card: Card;
  onEditCard: (card: Card) => void;
  onRemoveFromDeck: (card: Card) => void;
  onViewCard: (card: Card) => void;
  canEdit?: boolean;
  canRemove?: boolean;
  style?: React.CSSProperties;
  'data-index'?: number;
}

export const CardItem = forwardRef<HTMLDivElement, CardItemProps>(
  (
    {
      card,
      onEditCard,
      onRemoveFromDeck,
      onViewCard,
      canEdit = true,
      canRemove = true,
      style,
      'data-index': dataIndex,
    },
    ref,
  ) => {
    const hasExample = card.template_key === WORD_TO_TRANSLATION_TEMPLATE_KEY;

    return (
      <div
        ref={ref}
        style={style}
        data-index={dataIndex}
        className="flex flex-col md:grid md:grid-cols-[minmax(200px,1fr)_minmax(200px,1fr)_auto] gap-4 px-6 py-4 border-b border-border/30 hover:bg-muted/10 transition-colors last:border-0"
      >
        <div
          className="font-medium max-w-full md:max-w-62.5 truncate"
          title={card.front}
        >
          <MarkdownRenderer content={card.front} />
        </div>

        <div
          className="text-muted-foreground max-w-full md:max-w-62.5 truncate"
          title={card.back}
        >
          <MarkdownRenderer
            content={card.back}
            className={
              hasExample
                ? '[&_p+p]:!mt-3 [&_p+p]:text-xs [&_p+p]:font-normal'
                : ''
            }
          />
        </div>

        <div className="flex items-center justify-end md:justify-end gap-1.5 mt-2 md:mt-0">
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
          {canRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg cursor-pointer text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => onRemoveFromDeck(card)}
              title="Remove from Deck"
            >
              <Unlink className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  },
);

CardItem.displayName = 'CardItem';
