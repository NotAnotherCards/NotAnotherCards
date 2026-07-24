import React, { useState, useEffect } from "react";
import { useMockStore } from "@/hooks/useMockStore";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CheckCircle,
  HelpCircle,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
} from "lucide-react";

interface StudySessionProps {
  deckId: string;
  onClose: () => void;
}

export function StudySession({ deckId, onClose }: StudySessionProps) {
  const store = useMockStore();
  const deck = store.decks.find((d) => d.id === deckId);

  // Initialize the list of card IDs that are due for review
  const [queue, setQueue] = useState<string[]>([]);
  const [initialCount, setInitialCount] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const due = store.cards.filter(
      (c) => c.deckId === deckId && new Date(c.dueAt) <= new Date()
    );
    setQueue(due.map((c) => c.id));
    setInitialCount(due.length);
    setIsInitialized(true);
  }, [deckId]);

  if (!deck) {
    return (
      <div className="text-center p-8">
        <p className="text-destructive font-semibold">Deck not found.</p>
        <Button onClick={onClose} className="mt-4 cursor-pointer">
          <ArrowLeft className="size-4 mr-2" /> Back to Decks
        </Button>
      </div>
    );
  }

  // Get current active card
  const activeCardId = queue[0];
  const activeCard = store.cards.find((c) => c.id === activeCardId);

  const handleReveal = () => {
    setIsRevealed(true);
  };

  const handleRate = (rating: number) => {
    if (!activeCardId) return;

    // Record review in local storage / store state
    store.recordReview(activeCardId, rating);

    // SM-2 feedback loop
    if (rating === 0) {
      // "Again": Move the current card to the end of the queue so user gets another try
      setQueue((prev) => [...prev.slice(1), prev[0]]);
    } else {
      // "Hard", "Good", "Easy": Successfully cleared for this session
      setQueue((prev) => prev.slice(1));
      setReviewedCount((prev) => prev + 1);
    }

    // Reset card flip state
    setIsRevealed(false);
  };

  // Text-to-speech option (adds a premium touch!)
  const handleSpeak = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      // Auto-detect simple language code or use default English/Spanish based on deck name
      if (deck.name.toLowerCase().includes("spanish")) {
        utterance.lang = "es-ES";
      } else {
        utterance.lang = "en-US";
      }
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  };

  // Loading state while initializing
  if (!isInitialized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-87.5">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground mt-4">Preparing study deck...</p>
      </div>
    );
  }

  // Session Completed State
  if (queue.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-10 px-4 space-y-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="inline-flex p-4 bg-amber-500/10 rounded-full text-amber-500 border border-amber-500/20 shadow-inner animate-bounce">
          <Trophy className="size-12" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight font-heading text-foreground">
            Session Completed!
          </h2>
          <p className="text-sm text-muted-foreground">
            Congratulations! You've reviewed all due cards in <span className="font-semibold text-primary">{deck.name}</span>.
          </p>
        </div>

        <div className="p-4 bg-muted/30 border border-border/40 rounded-2xl grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-xs text-muted-foreground font-medium">Cards Cleared</div>
            <div className="text-2xl font-black text-emerald-500">{reviewedCount}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Next Session</div>
            <div className="text-sm font-semibold text-foreground mt-1.5 flex items-center justify-center gap-1">
              <Sparkles className="size-3.5 text-amber-500" />
              All caught up!
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 cursor-pointer"
          >
            Back to Decks
          </Button>
          {initialCount > 0 && (
            <Button
              onClick={() => {
                const due = store.cards.filter(
                  (c) => c.deckId === deckId && new Date(c.dueAt) <= new Date()
                );
                // If user wants to review same items again for practice, we can load all deck cards
                const practiceQueue = due.length > 0 ? due : store.cards.filter(c => c.deckId === deckId);
                setQueue(practiceQueue.map(c => c.id));
                setInitialCount(practiceQueue.length);
                setReviewedCount(0);
                setIsRevealed(false);
              }}
              className="flex-1 cursor-pointer gap-1.5"
            >
              <RotateCcw className="size-4" />
              Study Again
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Active Session State
  const remainingCount = queue.length;
  const progressPercent = initialCount > 0 ? ((initialCount - remainingCount) / initialCount) * 100 : 0;

  return (
    <div className="space-y-6 max-w-xl mx-auto animate-in fade-in duration-300">
      {/* Header and Progress Bar */}
      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="cursor-pointer text-muted-foreground hover:text-foreground p-0 h-auto"
          >
            <ArrowLeft className="size-4 mr-1" /> Quit Study
          </Button>
          <span className="font-semibold text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
            {remainingCount} card{remainingCount > 1 ? "s" : ""} remaining
          </span>
        </div>

        <div className="w-full h-2 bg-muted rounded-full overflow-hidden border border-border/20">
          <div
            className="h-full bg-linear-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Interactive 3D Flip Card Container */}
      <div
        className="perspective-1000 w-full min-h-80 relative cursor-pointer"
        onClick={() => !isRevealed && handleReveal()}
      >
        <div
          className={`w-full h-full min-h-80 transition-transform duration-500 preserve-3d relative ${
            isRevealed ? "rotate-y-180" : ""
          }`}
        >
          {/* FRONT Side */}
          <div className="backface-hidden w-full h-full min-h-80 bg-card rounded-4xl border border-border/80 p-8 flex flex-col justify-between items-center text-center shadow-lg hover:shadow-xl transition-shadow duration-300">
            <div className="w-full flex justify-between items-center text-xs text-muted-foreground">
              <span>FRONT</span>
              {activeCard && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={(e) => handleSpeak(activeCard.front, e)}
                  title="Listen to pronunciation"
                >
                  <Volume2 className="size-4" />
                </Button>
              )}
            </div>

            <div className="my-auto py-4">
              <h3 className="text-3xl font-bold tracking-tight text-foreground font-heading">
                {activeCard?.front}
              </h3>
            </div>

            <div className="text-xs text-muted-foreground/80 flex items-center gap-1.5 animate-pulse bg-muted/30 px-3.5 py-1.5 rounded-full border border-border/20">
              <HelpCircle className="size-3.5" />
              Click card or space to reveal answer
            </div>
          </div>

          {/* BACK Side */}
          <div className="backface-hidden rotate-y-180 w-full h-full min-h-80 bg-card rounded-4xl border border-border/80 p-8 flex flex-col justify-between items-center text-center shadow-lg absolute inset-0">
            <div className="w-full flex justify-between items-center text-xs text-muted-foreground">
              <span>BACK</span>
              {activeCard && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={(e) => handleSpeak(activeCard.back, e)}
                  title="Listen to pronunciation"
                >
                  <Volume2 className="size-4" />
                </Button>
              )}
            </div>

            <div className="my-auto py-4 space-y-4">
              <h4 className="text-3xl font-bold tracking-tight text-foreground font-heading">
                {activeCard?.back}
              </h4>
              {activeCard?.notes && (
                <p className="text-xs text-muted-foreground bg-muted/40 px-4 py-2.5 rounded-2xl border border-border/30 max-w-sm mx-auto">
                  {activeCard.notes}
                </p>
              )}
            </div>

            <div className="text-xs text-muted-foreground/80 flex items-center gap-1.5 px-3 py-1.5">
              <CheckCircle className="size-3.5 text-emerald-500" />
              Rate your recall quality below
            </div>
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="min-h-16 flex items-center justify-center">
        {!isRevealed ? (
          <Button
            size="lg"
            onClick={handleReveal}
            className="w-full cursor-pointer shadow-md bg-primary text-primary-foreground font-semibold h-12"
          >
            Show Answer
          </Button>
        ) : (
          <div className="grid grid-cols-4 gap-3 w-full">
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleRate(0)}
              className="cursor-pointer border-destructive/20 text-destructive bg-destructive/5 hover:bg-destructive/15 font-semibold h-12 transition-all"
            >
              <div className="flex flex-col items-center">
                <span className="text-sm">Again</span>
                <span className="text-[9px] font-normal opacity-80">Soon</span>
              </div>
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleRate(1)}
              className="cursor-pointer border-amber-500/20 text-amber-600 dark:text-amber-400 bg-amber-500/5 hover:bg-amber-500/15 font-semibold h-12 transition-all"
            >
              <div className="flex flex-col items-center">
                <span className="text-sm">Hard</span>
                <span className="text-[9px] font-normal opacity-80">12h</span>
              </div>
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleRate(2)}
              className="cursor-pointer border-blue-500/20 text-blue-600 dark:text-blue-400 bg-blue-500/5 hover:bg-blue-500/15 font-semibold h-12 transition-all"
            >
              <div className="flex flex-col items-center">
                <span className="text-sm">Good</span>
                <span className="text-[9px] font-normal opacity-80">1-3d</span>
              </div>
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleRate(3)}
              className="cursor-pointer border-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/15 font-semibold h-12 transition-all"
            >
              <div className="flex flex-col items-center">
                <span className="text-sm">Easy</span>
                <span className="text-[9px] font-normal opacity-80">3-5d</span>
              </div>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
