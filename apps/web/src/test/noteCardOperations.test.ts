import { afterEach, describe, expect, it, vi } from 'vitest';
import { Database, Q, randomId } from '@remelondb/core';
import { NodeSqliteDriver } from '@remelondb/driver-node';
import {
  ReviewEvent,
  UserCard,
  UserDeck,
  UserNote,
  UserNoteDeck,
  cardId,
  noteDeckId,
  schema,
} from '@repo/offline-db';
import {
  createCard,
  createCardsBatch,
  createDeck,
  deckDeletionSummary,
  deleteDeck,
  deleteDeckWithNotes,
  deleteNote,
  disableCard,
  getPersonalDictionaryQuery,
  getReviewHistoryQuery,
  recordReviewEvent,
  removeNoteFromDeck,
  updateCard,
} from '@repo/offline-db';

const openDatabases: Database[] = [];

async function openDatabase(): Promise<Database> {
  const db = await Database.open({
    driver: new NodeSqliteDriver(),
    schema,
    modelClasses: [UserDeck, UserNote, UserCard, UserNoteDeck, ReviewEvent],
    name: ':memory:',
  });
  openDatabases.push(db);
  return db;
}

async function createMembership(db: Database, noteId: string, deckId: string) {
  const now = Date.now();
  return await db.write(async () =>
    db.get(UserNoteDeck).create({
      id: noteDeckId(noteId, deckId),
      note_id: noteId,
      deck_id: deckId,
      active: true,
      created_at: now,
      updated_at: now,
    }),
  );
}

async function createSibling(
  db: Database,
  noteId: string,
  templateKey: string,
) {
  const now = Date.now();
  return await db.write(async () =>
    db.get(UserCard).create({
      id: cardId(noteId, templateKey),
      note_id: noteId,
      template_key: templateKey,
      active: true,
      front: 'back',
      back: 'front',
      due_at: now,
      scheduled_interval_minutes: 0,
      created_at: now,
      updated_at: now,
    }),
  );
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(openDatabases.splice(0).map((db) => db.driver.close()));
});

describe('note, card, and membership operations', () => {
  it('counts only active memberships when summarizing deck deletion', async () => {
    const db = await openDatabase();
    const deck = await createDeck(db, 'Deck');
    const otherDeck = await createDeck(db, 'Other deck');
    const thirdDeck = await createDeck(db, 'Third deck');
    const onlyHere = await createCard(db, deck.id, 'Only here', 'back');
    const shared = await createCard(db, deck.id, 'Shared', 'back');
    const inactiveElsewhere = await createCard(
      db,
      deck.id,
      'Inactive elsewhere',
      'back',
    );
    await createMembership(db, shared.note_id, otherDeck.id);
    await createMembership(db, shared.note_id, thirdDeck.id);
    await createMembership(db, inactiveElsewhere.note_id, otherDeck.id);
    await removeNoteFromDeck(db, inactiveElsewhere.note_id, otherDeck.id);

    const summary = await deckDeletionSummary(db, deck.id);

    expect(summary.orphanedNoteIds.sort()).toEqual(
      [onlyHere.note_id, inactiveElsewhere.note_id].sort(),
    );
    expect(summary.sharedNoteCount).toBe(1);
    expect(summary.orphanedCardCount).toBe(2);
    expect(summary.sharedCardCount).toBe(1);
    expect(await db.get(UserNote).query().fetch()).toHaveLength(3);
    expect(await db.get(UserCard).query().fetch()).toHaveLength(3);
  });

  it('ignores deleted memberships and notes removed from the selected deck', async () => {
    const db = await openDatabase();
    const deck = await createDeck(db, 'Deck');
    const otherDeck = await createDeck(db, 'Other deck');
    const orphan = await createCard(db, deck.id, 'Orphan', 'back');
    const deletedElsewhere = await createMembership(
      db,
      orphan.note_id,
      otherDeck.id,
    );
    const removed = await createCard(db, deck.id, 'Removed', 'back');
    await removeNoteFromDeck(db, removed.note_id, deck.id);
    const deletedHere = await createCard(
      db,
      deck.id,
      'Deleted membership',
      'back',
    );
    const deletedMembership = await db
      .get(UserNoteDeck)
      .find(noteDeckId(deletedHere.note_id, deck.id));
    await db.write(async () => {
      await db.batch([
        deletedElsewhere.prepareMarkAsDeleted(),
        deletedMembership.prepareMarkAsDeleted(),
      ]);
    });

    expect(await deckDeletionSummary(db, deck.id)).toEqual({
      orphanedNoteIds: [orphan.note_id],
      sharedNoteCount: 0,
      orphanedCardCount: 1,
      sharedCardCount: 0,
    });
  });

  it('returns an empty deletion summary for an empty deck', async () => {
    const db = await openDatabase();
    const deck = await createDeck(db, 'Empty deck');

    expect(await deckDeletionSummary(db, deck.id)).toEqual({
      orphanedNoteIds: [],
      sharedNoteCount: 0,
      orphanedCardCount: 0,
      sharedCardCount: 0,
    });
  });

  it('counts sibling cards including disabled cards, but not deleted cards', async () => {
    const db = await openDatabase();
    const deck = await createDeck(db, 'Deck');
    const otherDeck = await createDeck(db, 'Other deck');
    const orphan = await createCard(db, deck.id, 'Orphan', 'back');
    const disabled = await createSibling(db, orphan.note_id, 'back-front');
    await disableCard(db, disabled.id);
    const deleted = await createSibling(db, orphan.note_id, 'deleted');
    await db.write(async () => {
      await db.batch([deleted.prepareMarkAsDeleted()]);
    });
    const shared = await createCard(db, deck.id, 'Shared', 'back');
    await createSibling(db, shared.note_id, 'back-front');
    await createMembership(db, shared.note_id, otherDeck.id);

    expect(await deckDeletionSummary(db, deck.id)).toEqual({
      orphanedNoteIds: [orphan.note_id],
      sharedNoteCount: 1,
      orphanedCardCount: 2,
      sharedCardCount: 2,
    });
  });

  it('deletes a deck and its orphaned notes in one batch, keeping shared notes and history', async () => {
    const db = await openDatabase();
    const deck = await createDeck(db, 'Deck');
    const otherDeck = await createDeck(db, 'Other deck');
    const orphan = await createCard(db, deck.id, 'Orphan', 'back');
    const sibling = await createSibling(db, orphan.note_id, 'back-front');
    await recordReviewEvent(db, orphan.id, 2);
    await recordReviewEvent(db, sibling.id, 3);
    await disableCard(db, sibling.id);
    await createMembership(db, orphan.note_id, otherDeck.id);
    await removeNoteFromDeck(db, orphan.note_id, otherDeck.id);
    const shared = await createCard(db, deck.id, 'Shared', 'back');
    const sharedSibling = await createSibling(db, shared.note_id, 'back-front');
    const sharedReview = await recordReviewEvent(db, shared.id, 3);
    const siblingReview = await recordReviewEvent(db, sharedSibling.id, 2);
    const sharedMembership = await createMembership(
      db,
      shared.note_id,
      otherDeck.id,
    );
    const write = vi.spyOn(db, 'write');
    const batch = vi.spyOn(db, 'batch');

    await deleteDeckWithNotes(db, deck.id);

    expect(write).toHaveBeenCalledTimes(1);
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0][0]).toHaveLength(9);
    expect(await db.get(UserDeck).query().fetch()).toEqual([otherDeck]);
    expect(
      (await db.get(UserNote).query().fetch()).map((note) => note.id),
    ).toEqual([shared.note_id]);
    expect(await db.get(UserCard).query().fetch()).toEqual(
      expect.arrayContaining([shared, sharedSibling]),
    );
    expect(await db.get(UserCard).query().fetch()).toHaveLength(2);
    expect(await db.get(ReviewEvent).query().fetch()).toEqual(
      expect.arrayContaining([sharedReview, siblingReview]),
    );
    expect(await db.get(ReviewEvent).query().fetch()).toHaveLength(2);
    expect(await db.get(UserNoteDeck).query().fetch()).toEqual([
      sharedMembership,
    ]);
  });

  it('keeps notes, schedules and review history when deleting only the deck', async () => {
    const db = await openDatabase();
    const deck = await createDeck(db, 'Deck');
    const card = await createCard(db, deck.id, 'front', 'back');
    const review = await recordReviewEvent(db, card.id, 3);
    const scheduledCard = await db.get(UserCard).find(card.id);
    const dueAt = scheduledCard.due_at;

    await deleteDeck(db, deck.id);

    expect(await db.get(UserDeck).query().fetch()).toEqual([]);
    expect(await db.get(UserNoteDeck).query().fetch()).toEqual([]);
    expect(await db.get(UserNote).find(card.note_id)).toBeDefined();
    expect((await db.get(UserCard).find(card.id)).due_at).toBe(dueAt);
    expect(await getReviewHistoryQuery(db).fetch()).toEqual([review]);
  });

  it('deletes an empty deck without deleting notes previously removed from it', async () => {
    const db = await openDatabase();
    const deck = await createDeck(db, 'Deck');
    const card = await createCard(db, deck.id, 'Removed', 'back');
    await removeNoteFromDeck(db, card.note_id, deck.id);

    await deleteDeckWithNotes(db, deck.id);

    expect(await db.get(UserDeck).query().fetch()).toEqual([]);
    expect(await db.get(UserNoteDeck).query().fetch()).toEqual([]);
    expect(await db.get(UserNote).find(card.note_id)).toBeDefined();
    expect(await db.get(UserCard).find(card.id)).toBeDefined();
  });

  it('keeps the deck and its dependent rows if the deletion batch fails', async () => {
    const db = await openDatabase();
    const deck = await createDeck(db, 'Deck');
    const card = await createCard(db, deck.id, 'front', 'back');
    const review = await recordReviewEvent(db, card.id, 2);
    vi.spyOn(db, 'batch').mockRejectedValueOnce(new Error('Deletion failed'));

    await expect(deleteDeckWithNotes(db, deck.id)).rejects.toThrow(
      'Deletion failed',
    );

    expect(await db.get(UserDeck).find(deck.id)).toBeDefined();
    expect(await db.get(UserNote).find(card.note_id)).toBeDefined();
    expect(await db.get(UserCard).find(card.id)).toBeDefined();
    expect(
      await db.get(UserNoteDeck).find(noteDeckId(card.note_id, deck.id)),
    ).toBeDefined();
    expect(await db.get(ReviewEvent).find(review.id)).toBeDefined();
  });

  it('removes only the selected deck membership', async () => {
    const db = await openDatabase();
    const firstDeck = await createDeck(db, 'First deck');
    const secondDeck = await createDeck(db, 'Second deck');
    const card = await createCard(db, firstDeck.id, 'front', 'back');
    await createMembership(db, card.note_id, secondDeck.id);
    await recordReviewEvent(db, card.id, 3);

    await removeNoteFromDeck(db, card.note_id, firstDeck.id);

    expect(await getPersonalDictionaryQuery(db).fetch()).toHaveLength(1);
    expect(await getReviewHistoryQuery(db).fetch()).toHaveLength(1);
    expect(await db.get(UserNote).find(card.note_id)).toBeDefined();
    expect(
      (await db.get(UserNoteDeck).find(noteDeckId(card.note_id, firstDeck.id)))
        .active,
    ).toBe(false);
    expect(
      (await db.get(UserNoteDeck).find(noteDeckId(card.note_id, secondDeck.id)))
        .active,
    ).toBe(true);
  });

  it('disables only the selected sibling card', async () => {
    const db = await openDatabase();
    const deck = await createDeck(db, 'Deck');
    const firstCard = await createCard(db, deck.id, 'front', 'back');
    const sibling = await createSibling(db, firstCard.note_id, 'back-front');
    await recordReviewEvent(db, firstCard.id, 2);

    await disableCard(db, firstCard.id);

    expect((await db.get(UserCard).find(firstCard.id)).active).toBe(false);
    expect((await db.get(UserCard).find(sibling.id)).active).toBe(true);
    expect(await getPersonalDictionaryQuery(db).fetch()).toEqual([sibling]);
    expect(await getReviewHistoryQuery(db).fetch()).toHaveLength(1);
    expect(await db.get(UserNote).find(firstCard.note_id)).toBeDefined();
  });

  it('deletes a whole note and all of its dependent local rows explicitly', async () => {
    const db = await openDatabase();
    const deck = await createDeck(db, 'Deck');
    const firstCard = await createCard(db, deck.id, 'front', 'back');
    const sibling = await createSibling(db, firstCard.note_id, 'back-front');
    await recordReviewEvent(db, firstCard.id, 2);
    await recordReviewEvent(db, sibling.id, 3);

    await deleteNote(db, firstCard.note_id);

    await expect(db.get(UserNote).find(firstCard.note_id)).rejects.toThrow();
    expect(await getPersonalDictionaryQuery(db).fetch()).toEqual([]);
    expect(await getReviewHistoryQuery(db).fetch()).toEqual([]);
    expect(
      await db
        .get(UserNoteDeck)
        .query(Q.where('note_id', firstCard.note_id))
        .fetch(),
    ).toEqual([]);
  });

  it('edits basic notes but rejects structured notes without changing them', async () => {
    const db = await openDatabase();
    const deck = await createDeck(db, 'Deck');
    const basicCard = await createCard(db, deck.id, 'front', 'back');

    await updateCard(db, basicCard.id, 'new front', 'new back');

    const basicNote = await db.get(UserNote).find(basicCard.note_id);
    expect(JSON.parse(basicNote.fields_json)).toEqual({
      front: 'new front',
      back: 'new back',
    });
    expect((await db.get(UserCard).find(basicCard.id)).front).toBe('new front');

    const wordNoteId = randomId();
    const wordCardId = cardId(wordNoteId, 'original-translation');
    const wordFields = JSON.stringify({
      original_language: 'de',
      translation_language: 'en',
      original: 'Hund',
      translation: 'dog',
    });
    const now = Date.now();
    await db.write(async () => {
      await db.batch([
        db.get(UserNote).prepareCreate({
          id: wordNoteId,
          note_type: 'word',
          fields_version: 1,
          fields_json: wordFields,
          additional_content: null,
          created_at: now,
          updated_at: now,
        }),
        db.get(UserCard).prepareCreate({
          id: wordCardId,
          note_id: wordNoteId,
          template_key: 'original-translation',
          active: true,
          front: 'Hund',
          back: 'dog',
          due_at: now,
          scheduled_interval_minutes: 0,
          created_at: now,
          updated_at: now,
        }),
      ]);
    });

    await expect(
      updateCard(db, wordCardId, 'corrupted front', 'corrupted back'),
    ).rejects.toThrow('front/back editor only supports basic notes');
    expect((await db.get(UserNote).find(wordNoteId)).fields_json).toBe(
      wordFields,
    );
    expect((await db.get(UserCard).find(wordCardId)).front).toBe('Hund');
  });

  it('stores each multiplicative schedule and review event in one batch', async () => {
    const db = await openDatabase();
    const deck = await createDeck(db, 'Deck');
    const card = await createCard(db, deck.id, 'front', 'back');
    const reviewedAt = Date.parse('2026-08-30T10:00:00Z');
    vi.spyOn(Date, 'now').mockReturnValue(reviewedAt);
    const batch = vi.spyOn(db, 'batch');
    batch.mockClear();

    const review = await recordReviewEvent(db, card.id, 3);

    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0][0]).toHaveLength(2);
    const updatedCard = await db.get(UserCard).find(card.id);
    expect(updatedCard.scheduled_interval_minutes).toBe(3 * 24 * 60);
    expect(updatedCard.due_at).toBe(reviewedAt + 3 * 24 * 60 * 60_000);
    expect(review.reviewed_at).toBe(reviewedAt);
    expect(review.rating).toBe(3);

    const secondReviewAt = reviewedAt + 60_000;
    vi.mocked(Date.now).mockReturnValue(secondReviewAt);
    batch.mockClear();

    await recordReviewEvent(db, card.id, 3);

    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0][0]).toHaveLength(2);
    const reviewedAgain = await db.get(UserCard).find(card.id);
    expect(reviewedAgain.scheduled_interval_minutes).toBe(
      Math.round(3 * 24 * 60 * 2.5),
    );
    expect(reviewedAgain.due_at).toBe(
      secondReviewAt + Math.round(3 * 24 * 60 * 2.5) * 60_000,
    );
  });

  it('atomically creates a new deck and multiple cards in a single batch operation', async () => {
    const db = await openDatabase();
    const batchSpy = vi.spyOn(db, 'batch');

    const deckId = await createCardsBatch(db, {
      deckIdOrTitle: 'AI Generated Spanish Deck',
      isNew: true,
      description: 'AI Generated Cards',
      cards: [
        { front: 'Hola', back: 'Hello' },
        { front: 'Gracias', back: 'Thank you' },
      ],
    });

    expect(batchSpy).toHaveBeenCalledTimes(1);
    // 1 deck record + (3 records per card * 2 cards) = 7 records total in batch
    expect(batchSpy.mock.calls[0][0]).toHaveLength(7);

    const deck = await db.get(UserDeck).find(deckId);
    expect(deck.title).toBe('AI Generated Spanish Deck');
    expect(deck.description).toBe('AI Generated Cards');

    const cardsInDb = await getPersonalDictionaryQuery(db).fetch();
    expect(cardsInDb).toHaveLength(2);

    const notesInDb = await db.get(UserNote).query().fetch();
    expect(notesInDb).toHaveLength(2);

    const noteDecksInDb = await db.get(UserNoteDeck).query().fetch();
    expect(noteDecksInDb).toHaveLength(2);
  });

  it('rolls back completely if batch execution fails', async () => {
    const db = await openDatabase();

    // Mock db.batch to throw an error simulating database transaction failure midway
    vi.spyOn(db, 'batch').mockRejectedValueOnce(
      new Error('Simulated database write failure'),
    );

    await expect(
      createCardsBatch(db, {
        deckIdOrTitle: 'Failed AI Deck',
        isNew: true,
        description: 'Should rollback',
        cards: [
          { front: 'Failed 1', back: 'F1' },
          { front: 'Failed 2', back: 'F2' },
        ],
      }),
    ).rejects.toThrow('Simulated database write failure');

    // Verify nothing was persisted to the database
    expect(await db.get(UserDeck).query().fetch()).toHaveLength(0);
    expect(await db.get(UserNote).query().fetch()).toHaveLength(0);
    expect(await db.get(UserCard).query().fetch()).toHaveLength(0);
    expect(await db.get(UserNoteDeck).query().fetch()).toHaveLength(0);
  });

  it('fails one card creation mid-save and asserts no new deck, notes, or cards remain', async () => {
    const db = await openDatabase();

    const userCardCollection = db.get(UserCard);
    let cardCreateCount = 0;
    const originalPrepareCreate =
      userCardCollection.prepareCreate.bind(userCardCollection);
    vi.spyOn(userCardCollection, 'prepareCreate').mockImplementation(
      (args: Parameters<typeof userCardCollection.prepareCreate>[0]) => {
        cardCreateCount += 1;
        if (cardCreateCount === 2) {
          throw new Error('Mid-save failure on card #2');
        }
        return originalPrepareCreate(args);
      },
    );

    await expect(
      createCardsBatch(db, {
        deckIdOrTitle: 'Mid-Save Failure Deck',
        isNew: true,
        description: 'AI Generated Cards',
        cards: [
          { front: 'Card 1', back: 'C1' },
          { front: 'Card 2', back: 'C2' },
          { front: 'Card 3', back: 'C3' },
        ],
      }),
    ).rejects.toThrow('Mid-save failure on card #2');

    // Assert that NO deck, NO notes, NO cards, and NO noteDecks exist in the database
    expect(await db.get(UserDeck).query().fetch()).toHaveLength(0);
    expect(await db.get(UserNote).query().fetch()).toHaveLength(0);
    expect(await db.get(UserCard).query().fetch()).toHaveLength(0);
    expect(await db.get(UserNoteDeck).query().fetch()).toHaveLength(0);
  });
});
