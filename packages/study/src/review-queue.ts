export const REVIEW_BATCH_SIZE = 10;

/** The fields needed to choose a review batch on any client. */
export type ReviewQueueCard = {
  readonly id: string;
  readonly note_id: string;
  readonly due_at: number;
};

/** The cards due at `now`, earliest first; the order `selectReviewBatch` keeps. */
export function selectDueCards<T extends ReviewQueueCard>(
  cards: readonly T[],
  now: number = Date.now(),
): T[] {
  return cards
    .filter((card) => card.due_at <= now)
    .sort((first, second) => first.due_at - second.due_at);
}

/**
 * Keeps the caller's due-card order while allowing only one card from each
 * note in a batch. A sibling skipped here remains due for a later batch.
 */
export function selectReviewBatch<T extends ReviewQueueCard>(
  dueCards: readonly T[],
  batchSize: number = REVIEW_BATCH_SIZE,
): T[] {
  const selectedNoteIds = new Set<string>();
  const batch: T[] = [];

  for (const card of dueCards) {
    if (batch.length === batchSize) break;
    if (selectedNoteIds.has(card.note_id)) continue;

    selectedNoteIds.add(card.note_id);
    batch.push(card);
  }

  return batch;
}
