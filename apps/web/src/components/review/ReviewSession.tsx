import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/PageContainer';
import { CardForm } from '@/components/deck/CardForm';
import { Card } from '@/hooks/useStore';
import { writeErrorMessage } from '@/lib/write-error';
import { ArrowLeft, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  CURRENT_REVIEW_MODE,
  type ReviewAnswer,
  type ReviewMode,
} from './review-controls';
import { ReviewAnswerButtons } from './ReviewAnswerButtons';
import { ReviewCard, type ReviewCardExitDirection } from './ReviewCard';
import { DeleteConfirmationDialog, ReviewComplete } from './ReviewDialogs';
import { useReviewCardInteraction } from './useReviewCardInteraction';
import { useReviewKeyboardShortcuts } from './useReviewKeyboardShortcuts';

type ReviewSessionProps = {
  cards: Card[];
  deckTitle: string;
  onExit: () => void;
  onCreateCard: (data: { front: string; back: string }) => Promise<void>;
  onRecordReview: (cardId: string, rating: number) => Promise<{ id: string }>;
  onDeleteNote: (noteId: string) => Promise<void>;
  onRequestNextBatch?: () => Card[];
  reviewMode?: ReviewMode;
};

const REVIEW_CARD_EXIT_DURATION_MS = 250;

const reviewRatingByAnswer: Record<ReviewAnswer, number> = {
  forgot: 1,
  hard: 2,
  remember: 3,
  'very-easy': 4,
};

export function ReviewSession({
  cards,
  deckTitle,
  onExit,
  onCreateCard,
  onRecordReview,
  onDeleteNote,
  onRequestNextBatch,
  reviewMode = CURRENT_REVIEW_MODE,
}: ReviewSessionProps) {
  const [sessionCards, setSessionCards] = useState(cards);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isCreateCardOpen, setIsCreateCardOpen] = useState(false);
  const [createCardError, setCreateCardError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] =
    useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletingNote, setIsDeletingNote] = useState(false);
  const [exitDirection, setExitDirection] =
    useState<ReviewCardExitDirection | null>(null);
  const exitTimer = useRef<number | null>(null);
  const reviewCardRef = useRef<HTMLButtonElement>(null);
  const card = sessionCards[currentCardIndex];
  const nextCard = sessionCards[currentCardIndex + 1];
  const followingCard = sessionCards[currentCardIndex + 2];

  const revealAnswer = () => {
    setIsFlipped(true);
  };
  const openCreateCardForm = () => {
    setCreateCardError(null);
    setIsCreateCardOpen(true);
  };

  const createCard = async (data: { front: string; back: string }) => {
    setCreateCardError(null);
    try {
      await onCreateCard(data);
      setIsCreateCardOpen(false);
    } catch (err) {
      setCreateCardError(writeErrorMessage(err, 'Failed to create card'));
    }
  };

  const restoreCurrentCard = () => {
    reviewCardRef.current?.focus();
    setExitDirection(null);
    setIsDeleteConfirmationOpen(false);
    setDeleteError(null);
  };

  const deleteCurrentNote = async () => {
    if (isDeletingNote) return;

    const deletedNoteId = card.note_id;
    const deletedCardsBeforeCurrent = sessionCards
      .slice(0, currentCardIndex)
      .filter((sessionCard) => sessionCard.note_id === deletedNoteId).length;

    setDeleteError(null);
    setIsDeletingNote(true);

    try {
      await onDeleteNote(deletedNoteId);
    } catch {
      setDeleteError('Could not delete this word. Try again.');
      setIsDeletingNote(false);
      return;
    }

    setIsDeleteConfirmationOpen(false);
    setIsDeletingNote(false);
    setIsFlipped(false);
    setSessionCards((currentCards) =>
      currentCards.filter(
        (sessionCard) => sessionCard.note_id !== deletedNoteId,
      ),
    );
    setCurrentCardIndex(currentCardIndex - deletedCardsBeforeCurrent);
    setExitDirection(null);
  };

  const startCardExit = (direction: ReviewCardExitDirection) => {
    if (exitDirection) return;

    setExitDirection(direction);
    exitTimer.current = window.setTimeout(() => {
      cardInteraction.clearDrag();

      if (direction === 'delete') {
        setIsDeleteConfirmationOpen(true);
        return;
      }

      const isLastCardInBatch = currentCardIndex === sessionCards.length - 1;
      const nextBatch = isLastCardInBatch ? onRequestNextBatch?.() : [];

      setIsFlipped(false);
      if (nextBatch && nextBatch.length > 0) {
        setSessionCards(nextBatch);
        setCurrentCardIndex(0);
      } else {
        setCurrentCardIndex((index) => index + 1);
      }
      setExitDirection(null);
    }, REVIEW_CARD_EXIT_DURATION_MS);
  };

  const answerCard = async (answer: ReviewAnswer) => {
    if (isSavingReview || exitDirection) return;

    setReviewError(null);
    setIsSavingReview(true);

    try {
      await onRecordReview(card.id, reviewRatingByAnswer[answer]);
    } catch {
      setReviewError('Could not save your answer. Try again.');
      setIsSavingReview(false);
      return;
    }

    setIsSavingReview(false);
    const directionByAnswer: Record<
      Exclude<ReviewAnswer, 'very-easy'>,
      ReviewCardExitDirection
    > = {
      forgot: 'forgot',
      hard: 'hard',
      remember: 'remember',
    };

    if (answer === 'very-easy') {
      startCardExit('remember');
      return;
    }

    startCardExit(directionByAnswer[answer]);
  };

  useEffect(() => {
    return () => {
      if (exitTimer.current) window.clearTimeout(exitTimer.current);
    };
  }, []);

  const cardInteraction = useReviewCardInteraction({
    isFlipped,
    isBlocked: Boolean(exitDirection) || isSavingReview,
    reviewMode,
    onReveal: revealAnswer,
    onAnswer: (answer) => void answerCard(answer),
    onDelete: () => startCardExit('delete'),
  });

  useReviewKeyboardShortcuts({
    isFlipped,
    isBlocked:
      Boolean(exitDirection) ||
      isSavingReview ||
      isCreateCardOpen ||
      isDeleteConfirmationOpen,
    reviewMode,
    reviewCardElement: reviewCardRef.current,
    onReveal: revealAnswer,
    onAnswer: (answer) => void answerCard(answer),
    onDelete: () => startCardExit('delete'),
  });

  if (!card) {
    return <ReviewComplete onExit={onExit} />;
  }

  return (
    <PageContainer className="max-w-3xl py-4 sm:py-6">
      <div className="flex flex-col items-stretch">
        <h1 className="mb-3 text-center text-sm font-semibold text-muted-foreground sm:mx-auto sm:w-full sm:max-w-xl">
          {deckTitle}
        </h1>
        <ReviewCard
          card={card}
          nextCard={nextCard}
          followingCard={followingCard}
          isFlipped={isFlipped}
          isDragging={cardInteraction.isDragging}
          isSettlingDrag={cardInteraction.isSettlingDrag}
          dragOffset={cardInteraction.dragOffset}
          dragDirection={cardInteraction.dragDirection}
          exitDirection={exitDirection}
          cardButtonRef={reviewCardRef}
          onClick={cardInteraction.handleCardClick}
          onPointerDown={cardInteraction.handlePointerDown}
          onPointerMove={cardInteraction.handlePointerMove}
          onPointerUp={cardInteraction.handlePointerUp}
          onPointerCancel={cardInteraction.handlePointerCancel}
          onSettled={cardInteraction.handleSettled}
        />

        <div
          className="relative z-0 mt-6 min-h-[104px] sm:mx-auto sm:w-full sm:max-w-xl"
          data-testid="review-answer-area"
        >
          <ReviewAnswerButtons
            active={isFlipped}
            disabled={isSavingReview}
            onAnswer={answerCard}
            onReveal={revealAnswer}
          />
          {reviewError && (
            <p
              className="mt-2 text-center text-sm text-destructive"
              role="alert"
            >
              {reviewError}
            </p>
          )}
        </div>

        <div
          className="mt-6 grid grid-cols-3 gap-2 sm:mx-auto sm:w-full sm:max-w-xl"
          data-testid="review-footer-actions"
        >
          <div className="col-start-1 flex justify-start">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onExit}
              className="size-12 justify-start rounded-none bg-transparent p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="size-7" />
            </Button>
          </div>
          <div className="col-start-2" />
          <div className="col-start-3 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={openCreateCardForm}
              className="size-12 justify-end rounded-none bg-transparent p-0 text-black hover:bg-transparent hover:text-black"
              aria-label="Add a new card"
            >
              <Plus className="size-7" />
            </Button>
          </div>
        </div>
      </div>

      {isCreateCardOpen && (
        <CardForm
          title="Add New Card"
          onSubmit={createCard}
          error={createCardError}
          onCancel={() => setIsCreateCardOpen(false)}
        />
      )}

      {isDeleteConfirmationOpen && (
        <DeleteConfirmationDialog
          onCancel={restoreCurrentCard}
          onConfirm={() => void deleteCurrentNote()}
          error={deleteError}
          isDeleting={isDeletingNote}
        />
      )}
    </PageContainer>
  );
}
