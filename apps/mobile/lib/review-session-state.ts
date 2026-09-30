import type { UserCardRecord } from '@repo/offline-db';
import { selectReviewBatch } from '@repo/study';

// Where a review stands: the batch shown and the card's place in it, the
// answer revealed or not, what the review is busy with, the progress, and
// the card editor over the review. Everything here changes together, so one
// reducer holds it and each step is one action.
//
// Which cards come up and in which order is not decided here: batches come
// from @repo/study. The batch in hand stays fixed; when it is used up the
// phase becomes `loading-next`, and whoever runs the reducer reads the due
// cards afresh and answers with `next-batch` or `next-batch-failed`. The
// swipe keeps its own state (lib/use-review-swipe.ts), and so does the
// layout preference.

type Card = UserCardRecord;

type ReviewBatch = {
  deckId: string;
  cards: Card[];
};

// One thing at a time. Only `reviewing` takes a reveal or an answer.
// `read-failed` follows a saved answer or a delete whose next batch could
// not be read: only the read is retried, so nothing is saved twice.
export type ReviewPhase =
  'reviewing' | 'saving' | 'loading-next' | 'read-failed' | 'complete';

export type ReviewSessionState = {
  batch: ReviewBatch | null;
  index: number;
  revealed: boolean;
  phase: ReviewPhase;
  error: string | null;
  // Answers given so far, for progress across batches.
  answered: number;
  // What asked for the next batch, so a failed read can say what is safe.
  lastStep: 'answer' | 'delete' | null;
  // The full editor, or the swipe down's short delete question.
  editing:
    | { kind: 'new' }
    | { kind: 'edit'; card: Card }
    | { kind: 'delete'; card: Card }
    | null;
};

export type ReviewSessionAction =
  | { type: 'started'; deckId: string; cards: Card[] }
  | { type: 'revealed' }
  | { type: 'saving' }
  | { type: 'saved' }
  | { type: 'save-failed'; message: string }
  | { type: 'next-batch'; cards: Card[] }
  | { type: 'next-batch-failed' }
  | { type: 'next-batch-retry' }
  | { type: 'edit'; card: Card }
  | { type: 'delete'; card: Card }
  | { type: 'add' }
  | { type: 'editor-closed' }
  | { type: 'note-deleted'; noteId: string };

export const initialReviewSession: ReviewSessionState = {
  batch: null,
  index: 0,
  revealed: false,
  phase: 'reviewing',
  error: null,
  answered: 0,
  lastStep: null,
  editing: null,
};

// The card at `index` of `batch`, its answer hidden. When the batch is used
// up the position stays where it is and the next batch is asked for, so the
// screen keeps its shape until the new card is there.
function moveTo(
  state: ReviewSessionState,
  batch: ReviewBatch,
  index: number,
): ReviewSessionState {
  const next = { ...state, batch, revealed: false };
  return index < batch.cards.length
    ? { ...next, index, phase: 'reviewing' }
    : { ...next, phase: 'loading-next' };
}

export function reviewSessionReducer(
  state: ReviewSessionState,
  action: ReviewSessionAction,
): ReviewSessionState {
  switch (action.type) {
    // A deck's review starts from nothing: whatever the last deck's review
    // was busy with does not carry over.
    case 'started':
      return {
        ...initialReviewSession,
        batch: {
          deckId: action.deckId,
          cards: selectReviewBatch(action.cards),
        },
      };
    case 'revealed':
      return state.phase === 'reviewing' ? { ...state, revealed: true } : state;
    case 'saving':
      return state.phase === 'reviewing'
        ? { ...state, phase: 'saving', error: null }
        : state;
    case 'saved':
      if (state.phase !== 'saving' || !state.batch) return state;
      return moveTo(
        { ...state, answered: state.answered + 1, lastStep: 'answer' },
        state.batch,
        state.index + 1,
      );
    case 'save-failed':
      return state.phase === 'saving'
        ? { ...state, phase: 'reviewing', error: action.message }
        : state;
    case 'next-batch':
      if (state.phase !== 'loading-next' || !state.batch) return state;
      if (action.cards.length === 0) return { ...state, phase: 'complete' };
      return moveTo(
        state,
        { deckId: state.batch.deckId, cards: action.cards },
        0,
      );
    case 'next-batch-failed':
      return state.phase === 'loading-next'
        ? { ...state, phase: 'read-failed' }
        : state;
    case 'next-batch-retry':
      return state.phase === 'read-failed'
        ? { ...state, phase: 'loading-next' }
        : state;
    case 'edit':
      return { ...state, editing: { kind: 'edit', card: action.card } };
    case 'delete':
      return { ...state, editing: { kind: 'delete', card: action.card } };
    case 'add':
      return { ...state, editing: { kind: 'new' } };
    case 'editor-closed':
      return { ...state, editing: null };
    // Deleting removes the whole note, so its other cards leave the rest of
    // the session too; then it moves on as after an answer, without counting
    // one.
    case 'note-deleted': {
      const closed = { ...state, editing: null, lastStep: 'delete' as const };
      if (!state.batch) return closed;
      const kept = (card: Card) => card.note_id !== action.noteId;
      const { batch, index } = state;
      return moveTo(
        closed,
        {
          ...batch,
          cards: [
            ...batch.cards.slice(0, index),
            ...batch.cards.slice(index).filter(kept),
          ],
        },
        index,
      );
    }
  }
}
