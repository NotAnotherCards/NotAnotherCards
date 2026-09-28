import { describe, expect, it } from 'vitest';
import {
  selectDueCards,
  selectReviewBatch,
  type ReviewQueueCard,
} from './review-queue.js';

function makeCard(id: string, noteId: string): ReviewQueueCard {
  return { id, note_id: noteId, due_at: 1 };
}

describe('selectReviewBatch', () => {
  it('skips siblings and keeps scanning until the batch has ten distinct notes', () => {
    const firstSibling = makeCard('card-1', 'note-1');
    const secondSibling = makeCard('card-2', 'note-1');
    const otherCards = Array.from({ length: 10 }, (_, index) =>
      makeCard(`card-${index + 3}`, `note-${index + 2}`),
    );

    expect(
      selectReviewBatch([firstSibling, secondSibling, ...otherCards]),
    ).toEqual([firstSibling, ...otherCards.slice(0, 9)]);
  });

  it('returns a one-card batch when only sibling cards remain due', () => {
    const siblings = [
      makeCard('card-1', 'note-1'),
      makeCard('card-2', 'note-1'),
      makeCard('card-3', 'note-1'),
      makeCard('card-4', 'note-1'),
    ];

    expect(selectReviewBatch(siblings)).toEqual([siblings[0]]);
  });
});

describe('selectDueCards', () => {
  it('keeps cards due at or before now, earliest first', () => {
    const cards = [
      { id: 'later', note_id: 'n1', due_at: 300 },
      { id: 'future', note_id: 'n2', due_at: 501 },
      { id: 'now', note_id: 'n3', due_at: 500 },
      { id: 'earliest', note_id: 'n4', due_at: 100 },
    ];
    expect(selectDueCards(cards, 500).map((card) => card.id)).toEqual([
      'earliest',
      'later',
      'now',
    ]);
  });
});
