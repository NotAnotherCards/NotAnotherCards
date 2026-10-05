import { describe, expect, it } from 'vitest';
import {
  nextReviewBatch,
  selectDueCards,
  selectReviewBatch,
  type ReviewQueueCard,
} from './review-queue.js';

function makeCard(id: string, noteId: string): ReviewQueueCard {
  return {
    id,
    note_id: noteId,
    due_at: 1,
    active: true,
    front: 'front',
    back: 'back',
  };
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
      {
        id: 'later',
        note_id: 'n1',
        due_at: 300,
        active: true,
        front: 'a',
        back: 'b',
      },
      {
        id: 'future',
        note_id: 'n2',
        due_at: 501,
        active: true,
        front: 'a',
        back: 'b',
      },
      {
        id: 'now',
        note_id: 'n3',
        due_at: 500,
        active: true,
        front: 'a',
        back: 'b',
      },
      {
        id: 'earliest',
        note_id: 'n4',
        due_at: 100,
        active: true,
        front: 'a',
        back: 'b',
      },
    ];
    expect(selectDueCards(cards, 500).map((card) => card.id)).toEqual([
      'earliest',
      'later',
      'now',
    ]);
  });

  it('excludes inactive and incomplete cards', () => {
    const cards = [
      {
        id: 'inactive',
        note_id: 'n1',
        due_at: 1,
        active: false,
        front: 'a',
        back: 'b',
      },
      {
        id: 'empty-front',
        note_id: 'n2',
        due_at: 1,
        active: true,
        front: '',
        back: 'b',
      },
      {
        id: 'empty-back',
        note_id: 'n3',
        due_at: 1,
        active: true,
        front: 'a',
        back: '',
      },
      {
        id: 'ready',
        note_id: 'n4',
        due_at: 1,
        active: true,
        front: 'a',
        back: 'b',
      },
    ];
    expect(selectDueCards(cards, 1).map((card) => card.id)).toEqual(['ready']);
  });
});

describe('nextReviewBatch', () => {
  it('reads the due cards when asked, then selects from them', async () => {
    let due = [makeCard('a', 'note-a')];
    const read = async () => due;
    due = [makeCard('b', 'note-b'), makeCard('b2', 'note-b')];

    await expect(nextReviewBatch(read)).resolves.toEqual([
      makeCard('b', 'note-b'),
    ]);
  });

  it('passes a failed read on to the caller', async () => {
    await expect(
      nextReviewBatch(() => Promise.reject(new Error('read failed'))),
    ).rejects.toThrow('read failed');
  });
});
