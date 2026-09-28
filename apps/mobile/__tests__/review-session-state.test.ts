import type { UserCardRecord } from '@repo/offline-db';
import {
  initialReviewSession,
  reviewSessionReducer,
  type ReviewSessionAction,
  type ReviewSessionState,
} from '@/lib/review-session-state';

type TestCard = UserCardRecord;

const card = (id: string, noteId = `note-${id}`): TestCard => ({
  id,
  note_id: noteId,
  template_key: 'basic:front-back',
  active: true,
  front: id,
  back: id,
  due_at: 0,
  scheduled_interval_minutes: 0,
  created_at: 0,
  updated_at: 0,
});
const cards = (count: number) =>
  Array.from({ length: count }, (_, i) => card(`c${i + 1}`));

const run = (...actions: ReviewSessionAction[]) =>
  actions.reduce<ReviewSessionState>(
    reviewSessionReducer,
    initialReviewSession,
  );
const current = (state: ReviewSessionState) =>
  state.batch?.cards[state.index]?.id;
const answer: ReviewSessionAction[] = [
  { type: 'revealed' },
  { type: 'saving' },
  { type: 'saved' },
];

describe('reviewSessionReducer', () => {
  it('starts with a batch of ten, the answer hidden', () => {
    const state = run({ type: 'started', deckId: 'd1', cards: cards(12) });

    expect(state.batch?.cards).toHaveLength(10);
    expect(current(state)).toBe('c1');
    expect(state.revealed).toBe(false);
  });

  it('counts an answer, hides the next answer and moves on', () => {
    const state = run(
      { type: 'started', deckId: 'd1', cards: cards(3) },
      ...answer,
    );

    expect(state).toMatchObject({
      answered: 1,
      revealed: false,
      phase: 'reviewing',
    });
    expect(current(state)).toBe('c2');
  });

  it('asks for the next batch after the last answer of a batch', () => {
    const state = run(
      { type: 'started', deckId: 'd1', cards: cards(2) },
      ...answer,
      ...answer,
    );

    expect(state).toMatchObject({ answered: 2, phase: 'loading-next' });
  });

  it('starts the batch that was read', () => {
    const state = run(
      { type: 'started', deckId: 'd1', cards: cards(1) },
      ...answer,
      { type: 'next-batch', cards: [card('new')] },
    );

    expect(current(state)).toBe('new');
    expect(state).toMatchObject({ index: 0, phase: 'reviewing' });
  });

  it('completes when the read finds nothing due', () => {
    const state = run(
      { type: 'started', deckId: 'd1', cards: cards(1) },
      ...answer,
      { type: 'next-batch', cards: [] },
    );

    expect(state).toMatchObject({ phase: 'complete', answered: 1 });
  });

  it('keeps the answer counted when the read fails, and retries the read', () => {
    const failed = run(
      { type: 'started', deckId: 'd1', cards: cards(1) },
      ...answer,
      { type: 'next-batch-failed' },
    );
    expect(failed).toMatchObject({ answered: 1, phase: 'read-failed' });

    const retried = reviewSessionReducer(failed, { type: 'next-batch-retry' });
    expect(retried).toMatchObject({ answered: 1, phase: 'loading-next' });
  });

  it('shows the next batch with its answer hidden, whatever was tapped meanwhile', () => {
    const state = run(
      { type: 'started', deckId: 'd1', cards: cards(1) },
      ...answer,
      // a tap on "Show answer" while the next batch is being read
      { type: 'revealed' },
      { type: 'next-batch', cards: [card('new')] },
    );

    expect(current(state)).toBe('new');
    expect(state.revealed).toBe(false);
  });

  it('takes no answer while the next batch is being read', () => {
    const state = run(
      { type: 'started', deckId: 'd1', cards: cards(1) },
      ...answer,
      { type: 'saving' },
      { type: 'saved' },
    );

    expect(state).toMatchObject({ answered: 1, phase: 'loading-next' });
  });

  it('starts another deck from nothing, even during a read', () => {
    const state = run(
      { type: 'started', deckId: 'd1', cards: cards(1) },
      ...answer,
      { type: 'started', deckId: 'd2', cards: cards(3) },
    );

    expect(state).toMatchObject({
      phase: 'reviewing',
      answered: 0,
      index: 0,
      revealed: false,
    });
    expect(state.batch?.deckId).toBe('d2');
  });

  it('keeps the card and the answer after a failed save', () => {
    const state = run(
      { type: 'started', deckId: 'd1', cards: cards(2) },
      { type: 'revealed' },
      { type: 'saving' },
      { type: 'save-failed', message: 'Could not save your answer' },
    );

    expect(current(state)).toBe('c1');
    expect(state).toMatchObject({
      revealed: true,
      phase: 'reviewing',
      answered: 0,
      error: 'Could not save your answer',
    });
  });

  it('clears the error when the next save starts', () => {
    const state = run(
      { type: 'started', deckId: 'd1', cards: cards(2) },
      { type: 'revealed' },
      { type: 'saving' },
      { type: 'save-failed', message: 'failed' },
      { type: 'saving' },
    );

    expect(state.error).toBeNull();
  });

  it('opens and closes the editor without moving', () => {
    const opened = run(
      { type: 'started', deckId: 'd1', cards: cards(2) },
      { type: 'edit', card: card('c1'), confirmDelete: true },
    );
    expect(opened.editing).toEqual({
      kind: 'edit',
      card: card('c1'),
      confirmDelete: true,
    });
    expect(reviewSessionReducer(opened, { type: 'add' }).editing).toEqual({
      kind: 'new',
    });

    const closed = reviewSessionReducer(opened, { type: 'editor-closed' });
    expect(closed.editing).toBeNull();
    expect(current(closed)).toBe('c1');
  });

  it('drops a deleted note from the rest of the session without counting it', () => {
    const due = [
      card('a1', 'note-a'),
      card('b1', 'note-b'),
      card('a2', 'note-a'),
      ...cards(10),
    ];
    const state = run(
      { type: 'started', deckId: 'd1', cards: due },
      { type: 'revealed' },
      { type: 'edit', card: due[0]! },
      { type: 'note-deleted', noteId: 'note-a' },
    );

    expect(current(state)).toBe('b1');
    expect(state).toMatchObject({
      answered: 0,
      revealed: false,
      editing: null,
    });
    const left = state.batch!.cards;
    expect(left.some((c) => c.note_id === 'note-a')).toBe(false);
  });

  it('asks for the next batch when the deleted note was the last card', () => {
    const state = run(
      { type: 'started', deckId: 'd1', cards: [card('a1', 'note-a')] },
      { type: 'note-deleted', noteId: 'note-a' },
    );

    expect(state).toMatchObject({ phase: 'loading-next', answered: 0 });
  });
});
