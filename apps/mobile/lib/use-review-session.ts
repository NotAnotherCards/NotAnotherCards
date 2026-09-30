import { useEffect, useReducer } from 'react';
import type { DatabaseManager } from '@remelondb/core';
import {
  nextReviewBatch,
  reviewRatingByAnswer,
  type ReviewAnswer,
} from '@repo/offline-db';
import { writeErrorMessage } from './errors';
import { useReviewDeck } from './review';
import { saveLastReviewDeckId } from './review-preferences';
import {
  initialReviewSession,
  reviewSessionReducer,
} from './review-session-state';

// One deck's review for the screen: the reducer holds where the review
// stands (lib/review-session-state.ts), and this adds what touches the
// database: the deck and its due cards, the first batch once they have
// loaded, the next batches from a fresh read, saving an answer, and
// remembering the deck for Start Review.
// `status` says which screen to show; the deck and the card come with the
// statuses that have them.
export function useReviewSession(
  manager: DatabaseManager,
  deckId: string,
  userId: string,
) {
  const { deck, dueCards, readDueCards, isLoading, error, writes } =
    useReviewDeck(manager, deckId);
  const [state, dispatch] = useReducer(
    reviewSessionReducer,
    initialReviewSession,
  );

  useEffect(() => {
    if (deck && userId) saveLastReviewDeckId(userId, deck.id);
  }, [deck, userId]);

  useEffect(() => {
    if (!isLoading && deck && state.batch?.deckId !== deckId) {
      dispatch({ type: 'started', deckId, cards: dueCards });
    }
  }, [deck, deckId, dueCards, isLoading, state.batch?.deckId]);

  // The reducer asks for the next batch; it comes from the due cards as they
  // are now, so cards that became due, arrived through sync or were deleted
  // during the session are taken into account.
  useEffect(() => {
    if (state.phase !== 'loading-next') return;
    let cancelled = false;
    nextReviewBatch(readDueCards).then(
      (cards) => {
        if (!cancelled) dispatch({ type: 'next-batch', cards });
      },
      () => {
        if (!cancelled) dispatch({ type: 'next-batch-failed' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [readDueCards, state.phase]);

  // The batch keeps the order; the text comes from the live card, so an
  // edit made in the review shows at once.
  const batchCard = state.batch?.cards[state.index];
  const card =
    batchCard && (dueCards.find((due) => due.id === batchCard.id) ?? batchCard);

  // Resolves whether the answer was saved.
  const answer = async (given: ReviewAnswer) => {
    if (!card || !writes || !state.revealed || state.phase !== 'reviewing')
      return false;
    dispatch({ type: 'saving' });
    try {
      await writes.record(card.id, reviewRatingByAnswer[given]);
      dispatch({ type: 'saved' });
      return true;
    } catch (cause) {
      dispatch({
        type: 'save-failed',
        message: writeErrorMessage(cause, 'Could not save your answer'),
      });
      return false;
    }
  };

  const session = {
    // What the swipe follows, and the question it previews.
    // ponytail: previews within the current batch only; the next batch's
    // first card cannot show before that batch exists.
    position: { batch: state.batch, index: state.index },
    nextFront: state.batch?.cards[state.index + 1]?.front ?? null,
    revealed: state.revealed,
    // Saving an answer or reading the next batch: nothing else is taken.
    busy: state.phase === 'saving' || state.phase === 'loading-next',
    saveError: state.error,
    editing: state.editing,
    // Answered, plus every card still due: the live query drops a card once
    // it is answered and brings it back if it falls due again.
    progress: {
      answered: state.answered,
      total: state.answered + dueCards.length,
    },
    reveal: () => dispatch({ type: 'revealed' }),
    answer,
    edit: () => {
      if (card) dispatch({ type: 'edit', card });
    },
    // The swipe down's question, without the editor.
    confirmDelete: () => {
      if (card) dispatch({ type: 'delete', card });
    },
    add: () => dispatch({ type: 'add' }),
    closeEditor: () => dispatch({ type: 'editor-closed' }),
    noteDeleted: (noteId: string) => dispatch({ type: 'note-deleted', noteId }),
    retryNextBatch: () => dispatch({ type: 'next-batch-retry' }),
  };

  if (isLoading || !writes) return { ...session, status: 'loading' as const };
  if (error) return { ...session, status: 'error' as const, error };
  if (!deck) return { ...session, status: 'missing' as const };
  if (state.batch?.deckId !== deckId)
    return { ...session, status: 'loading' as const };
  if (state.phase === 'read-failed')
    return {
      ...session,
      status: 'next-batch-failed' as const,
      deck,
      lastStep: state.lastStep,
    };
  if (state.phase === 'complete')
    return { ...session, status: 'complete' as const, deck };
  // The batch ran out through a delete and the next one is being read.
  if (!card && state.phase === 'loading-next')
    return { ...session, status: 'loading' as const };
  if (!card) return { ...session, status: 'empty' as const, deck };
  return { ...session, status: 'active' as const, deck, card };
}
