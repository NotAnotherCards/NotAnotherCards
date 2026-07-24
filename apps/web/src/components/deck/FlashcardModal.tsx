import { useState } from "react";
import { Card } from "@/hooks/useMockStore";
import { Button } from "@/components/ui/button";
import { X, RefreshCw } from "lucide-react";

interface FlashcardModalProps {
  card: Card;
  onClose: () => void;
}

export function FlashcardModal({ card, onClose }: FlashcardModalProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      {/* Close button at top right of viewport */}
      <div className="absolute top-4 right-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={onClose}
          className="rounded-full bg-background border border-border/80 cursor-pointer shadow-md hover:bg-muted"
          title="Close Modal"
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* 3D Flip Card Outer Container */}
      <div
        className="w-full max-w-lg h-80 select-none"
        style={{ perspective: "1000px" }}
      >
        {/* Flip Card Inner Wrapper */}
        <div
          onClick={() => setIsFlipped(!isFlipped)}
          className="w-full h-full relative cursor-pointer rounded-3xl transition-transform duration-500 shadow-2xl"
          style={{
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
          data-testid="flashcard-inner"
        >
          {/* FRONT Side */}
          <div
            className="absolute inset-0 w-full h-full rounded-3xl border border-border/80 bg-linear-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 flex flex-col items-center justify-center p-8 transition-colors duration-300"
            style={{
              backfaceVisibility: "hidden",
            }}
            data-testid="flashcard-front"
          >
            {/* Tag Badge */}
            <span className="absolute top-4 left-4 text-[10px] tracking-wider uppercase font-bold text-muted-foreground/60 bg-muted/40 px-2 py-0.5 rounded-full">
              Front Side
            </span>

            {/* Front text */}
            <h3 className="text-3xl font-bold tracking-tight text-foreground text-center font-heading max-w-full overflow-y-auto max-h-48 wrap-break-word pr-1">
              {card.front}
            </h3>

            {/* Hint footer */}
            <div className="absolute bottom-4 flex items-center gap-1.5 text-xs text-muted-foreground/60 font-medium">
              <RefreshCw className="size-3.5" />
              Click card to flip
            </div>
          </div>

          {/* BACK Side */}
          <div
            className="absolute inset-0 w-full h-full rounded-3xl border border-border/80 bg-linear-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 flex flex-col items-center justify-center p-8 transition-colors duration-300"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
            data-testid="flashcard-back"
          >
            {/* Tag Badge */}
            <span className="absolute top-4 left-4 text-[10px] tracking-wider uppercase font-bold text-primary/60 bg-primary/10 px-2 py-0.5 rounded-full">
              Back Side
            </span>

            {/* Back text */}
            <h3 className="text-3xl font-bold tracking-tight text-primary text-center font-heading max-w-full overflow-y-auto max-h-36 wrap-break-word pr-1">
              {card.back}
            </h3>

            {/* Optional Notes */}
            {card.notes && (
              <p className="text-sm text-muted-foreground text-center max-w-md mt-4 overflow-y-auto max-h-16 wrap-break-word border-t border-border/40 pt-2.5 w-full pr-1">
                {card.notes}
              </p>
            )}

            {/* Hint footer */}
            <div className="absolute bottom-4 flex items-center gap-1.5 text-xs text-muted-foreground/60 font-medium">
              <RefreshCw className="size-3.5" />
              Click card to flip
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
