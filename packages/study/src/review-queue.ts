export const REVIEW_BATCH_SIZE = 10;

/** The fields needed to choose a review batch on any client. */
export type ReviewQueueCard = {
  readonly id: string;
  readonly note_id: string;
  readonly due_at: number;
  readonly active?: boolean;
  readonly front?: string;
  readonly back?: string;
};

/** The cards due at `now`, earliest first; the order `selectReviewBatch` keeps. */
export function selectDueCards<T extends ReviewQueueCard>(
  cards: readonly T[],
  now: number = Date.now(),
): T[] {
  return cards
    .filter(
      (card) =>
        card.active !== false &&
        card.front !== '' &&
        card.back !== '' &&
        card.due_at <= now,
    )
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

/**
 * The next batch, from the due cards as they are when it is asked for: a card
 * that became due, arrived through sync or was deleted since the session began
 * is taken into account. Each client passes its own read; the selection is the
 * same on all of them.
 */
export async function nextReviewBatch<T extends ReviewQueueCard>(
  readDueCards: () => Promise<readonly T[]> | readonly T[],
  batchSize: number = REVIEW_BATCH_SIZE,
): Promise<T[]> {
  return selectReviewBatch(await readDueCards(), batchSize);
}
