export const REVIEW_BATCH_SIZE = 10;

/** The fields needed to choose a review batch on any client. */
export type ReviewQueueCard = {
  readonly id: string;
  readonly note_id: string;
  readonly due_at: number;
};

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
