import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card } from '@/hooks/useStore';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';

type FlashcardModalProps = {
  card: Card;
  onClose: () => void;
};

/** Read-only preview. Review answers belong to the deck review route. */
export function FlashcardModal({ card, onClose }: FlashcardModalProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/65 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="h-80 w-full max-w-lg select-none"
        style={{ perspective: '1000px' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          onClick={() => setIsFlipped((flipped) => !flipped)}
          className="relative h-full w-full cursor-pointer rounded-3xl shadow-2xl transition-transform duration-500"
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
          data-testid="flashcard-inner"
        >
          <div
            className="absolute inset-0 flex h-full w-full flex-col items-center justify-center rounded-3xl border border-border/80 bg-linear-to-br from-white to-zinc-100/50 p-8 transition-colors duration-300 dark:from-zinc-800 dark:to-zinc-900"
            style={{ backfaceVisibility: 'hidden' }}
            data-testid="flashcard-front"
          >
            <span className="absolute top-4 left-4 rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-bold tracking-wider text-muted-foreground/60 uppercase">
              Question / Front
            </span>
            <h3 className="max-h-48 max-w-full overflow-y-auto wrap-break-word pr-1 text-center font-heading text-3xl font-bold tracking-tight text-foreground">
              <MarkdownRenderer content={card.front} inline />
            </h3>
            <div className="absolute bottom-4 flex items-center gap-1.5 text-xs font-medium text-muted-foreground/60">
              <RefreshCw className="size-3.5" />
              Click card to flip
            </div>
          </div>
          <div
            className="absolute inset-0 flex h-full w-full flex-col items-center justify-center rounded-3xl border border-border/80 bg-linear-to-br from-white to-zinc-100/50 p-8 transition-colors duration-300 dark:from-zinc-800 dark:to-zinc-900"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
            data-testid="flashcard-back"
          >
            <span className="absolute top-4 left-4 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-primary/60 uppercase">
              Answer / Back
            </span>
            <h3 className="max-h-32 max-w-full overflow-y-auto wrap-break-word pr-1 text-center font-heading text-3xl font-bold tracking-tight text-primary">
              <MarkdownRenderer content={card.back} inline />
            </h3>
          </div>
        </div>
      </div>
    </div>
  );
}
