import { useState, useEffect } from "react";
import { Card, useStore } from "@/hooks/useStore";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface FlashcardModalProps {
  card?: Card;
  cards?: Card[];
  initialCardId?: string;
  onClose: () => void;
}

export function FlashcardModal({
  card: singleCard,
  cards = [],
  initialCardId,
  onClose,
}: FlashcardModalProps) {
  const store = useStore();
  const modalCards = cards.length > 0 ? cards : singleCard ? [singleCard] : [];
  const [currentCardId, setCurrentCardId] = useState(
    initialCardId || singleCard?.id || "",
  );
  const [isFlipped, setIsFlipped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentIndex = modalCards.findIndex((c) => c.id === currentCardId);
  const activeCard = modalCards[currentIndex] || modalCards[0];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (modalCards.length <= 1) return;

      if (e.key === "ArrowRight") {
        setIsFlipped(false);
        const nextIndex = (currentIndex + 1) % modalCards.length;
        setCurrentCardId(modalCards[nextIndex].id);
      } else if (e.key === "ArrowLeft") {
        setIsFlipped(false);
        const prevIndex =
          (currentIndex - 1 + modalCards.length) % modalCards.length;
        setCurrentCardId(modalCards[prevIndex].id);
      } else if (e.key === " ") {
        e.preventDefault();
        setIsFlipped((f) => !f);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, modalCards, onClose]);

  if (!activeCard) return null;

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFlipped(false);
    const nextIndex = (currentIndex + 1) % modalCards.length;
    setCurrentCardId(modalCards[nextIndex].id);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFlipped(false);
    const prevIndex =
      (currentIndex - 1 + modalCards.length) % modalCards.length;
    setCurrentCardId(modalCards[prevIndex].id);
  };

  const handleReview = async (rating: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);
    try {
      await store.recordReview(activeCard.id, rating);
      setIsFlipped(false);
      if (modalCards.length > 1) {
        const nextIndex = (currentIndex + 1) % modalCards.length;
        setCurrentCardId(modalCards[nextIndex].id);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record review");
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-in fade-in duration-200"
    >
      {/* 3D Flip Card Outer Container */}
      <div
        className="w-full max-w-lg h-80 select-none"
        style={{ perspective: "1000px" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Flip Card Inner Wrapper */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            setIsFlipped(!isFlipped);
          }}
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
              Question / Front
            </span>

            {/* Front text */}
            <h3 className="text-3xl font-bold tracking-tight text-foreground text-center font-heading max-w-full overflow-y-auto max-h-48 wrap-break-word pr-1">
              {activeCard.front}
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
              Answer / Back
            </span>

            {/* Back text */}
            <h3 className="text-3xl font-bold tracking-tight text-primary text-center font-heading max-w-full overflow-y-auto max-h-32 wrap-break-word pr-1">
              {activeCard.back}
            </h3>

            {/* Review Action Rating Buttons */}
            <div className="absolute bottom-4 flex items-center gap-1.5 z-20">
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer text-[11px] h-7 px-2 border-destructive/30 hover:bg-destructive/10 text-destructive"
                onClick={(e) => handleReview(1, e)}
              >
                Again (5m)
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer text-[11px] h-7 px-2 border-orange-500/30 hover:bg-orange-500/10 text-orange-600 dark:text-orange-400"
                onClick={(e) => handleReview(2, e)}
              >
                Hard (1d)
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer text-[11px] h-7 px-2 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                onClick={(e) => handleReview(3, e)}
              >
                Good (3d)
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer text-[11px] h-7 px-2 border-blue-500/30 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                onClick={(e) => handleReview(4, e)}
              >
                <CheckCircle2 className="size-3 mr-1" />
                Easy (7d)
              </Button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 max-w-lg w-full text-center text-xs text-red-500 bg-red-500/10 border border-red-500/20 py-2 px-4 rounded-xl font-medium"
        >
          {error}
        </div>
      )}

      {/* Navigation controls */}
      {modalCards.length > 1 && (
        <div
          className="flex items-center gap-4 mt-6 bg-zinc-900/85 dark:bg-zinc-950/85 border border-zinc-800/80 px-4 py-2 rounded-2xl shadow-xl backdrop-blur-md"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer h-8 gap-1 text-zinc-300 hover:text-white hover:bg-zinc-800/50"
            onClick={handlePrev}
          >
            <ChevronLeft className="size-4" />
            Prev
          </Button>
          <span className="text-xs text-zinc-400 font-medium font-mono min-w-12 text-center select-none">
            {currentIndex + 1} / {modalCards.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer h-8 gap-1 text-zinc-300 hover:text-white hover:bg-zinc-800/50"
            onClick={handleNext}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
