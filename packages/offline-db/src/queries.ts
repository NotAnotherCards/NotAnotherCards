import { Database, Q, randomId, type BatchOperation } from '@remelondb/core';
import {
  ReviewEvent,
  UserCard,
  UserDeck,
  UserNote,
  UserNoteDeck,
  UserProfile,
} from './user-dictionary.js';
import { BASIC_FRONT_BACK_TEMPLATE_KEY, cardId, noteDeckId } from './ids.js';
import {
  BASIC_NOTE_FIELDS_VERSION,
  BASIC_NOTE_TYPE,
} from './note-constants.js';
import { calculateReviewSchedule } from './review-scheduler.js';

// ==========================================
// QUERIES
// ==========================================

export function getDecksQuery(db: Database) {
  return db.get(UserDeck).query(Q.sortBy('created_at', Q.desc));
}

export function getPersonalDictionaryQuery(db: Database) {
  return db
    .get(UserCard)
    .query(Q.where('active', true), Q.sortBy('created_at', Q.desc));
}

export function getNotesQuery(db: Database) {
  return db.get(UserNote).query(Q.sortBy('created_at', Q.desc));
}

export function getDueCardsQuery(db: Database, now: number = Date.now()) {
  return db
    .get(UserCard)
    .query(
      Q.where('active', true),
      Q.where('due_at', Q.lte(now)),
      Q.sortBy('due_at', Q.asc),
    );
}

export function getCardDetailQuery(db: Database, cardId: string) {
  return db.get(UserCard).query(Q.where('id', cardId));
}

export function getReviewHistoryQuery(db: Database, userCardId?: string) {
  if (userCardId) {
    return db
      .get(ReviewEvent)
      .query(
        Q.where('user_card_id', userCardId),
        Q.sortBy('reviewed_at', Q.desc),
      );
  }
  return db.get(ReviewEvent).query(Q.sortBy('reviewed_at', Q.desc));
}

export function getUserProfileQuery(db: Database) {
  return db.get(UserProfile).query();
}

export function getNoteDecksQuery(db: Database) {
  return db.get(UserNoteDeck).query(Q.where('active', true));
}

// ==========================================
// LOCAL WRITES
// ==========================================

export async function createDeck(
  db: Database,
  title: string,
  description?: string | null,
) {
  return await db.write(async () => {
    const now = Date.now();
    return await db.get(UserDeck).create({
      title,
      description: description || null,
      created_at: now,
      updated_at: now,
    });
  });
}

export async function updateDeck(
  db: Database,
  deckId: string,
  title: string,
  description?: string | null,
) {
  return await db.write(async () => {
    const now = Date.now();
    const deck = await db.get(UserDeck).find(deckId);
    return await deck.update((record) => {
      record.title = title;
      record.description = description || null;
      record.updated_at = now;
    });
  });
}

export async function deleteDeck(db: Database, deckId: string) {
  return await db.write(async () => {
    const deck = await db.get(UserDeck).find(deckId);
    const noteDecks = await db
      .get(UserNoteDeck)
      .query(Q.where('deck_id', deckId))
      .fetch();
    await db.batch([
      ...noteDecks.map((noteDeck) => noteDeck.prepareMarkAsDeleted()),
      deck.prepareMarkAsDeleted(),
    ]);
  });
}

export async function createCard(
  db: Database,
  deckId: string,
  front: string,
  back: string,
) {
  return await db.write(async () => {
    const now = Date.now();
    const noteId = randomId();
    const templateKey = BASIC_FRONT_BACK_TEMPLATE_KEY;
    const generatedCardId = cardId(noteId, templateKey);
    const membershipId = noteDeckId(noteId, deckId);
    const note = db.get(UserNote).prepareCreate({
      id: noteId,
      note_type: BASIC_NOTE_TYPE,
      fields_version: BASIC_NOTE_FIELDS_VERSION,
      fields_json: JSON.stringify({ front, back }),
      additional_content: null,
      created_at: now,
      updated_at: now,
    });
    const card = db.get(UserCard).prepareCreate({
      id: generatedCardId,
      note_id: noteId,
      template_key: templateKey,
      active: true,
      front,
      back,
      due_at: now,
      scheduled_interval_minutes: 0,
      created_at: now,
      updated_at: now,
    });
    const noteDeck = db.get(UserNoteDeck).prepareCreate({
      id: membershipId,
      note_id: noteId,
      deck_id: deckId,
      active: true,
      created_at: now,
      updated_at: now,
    });
    await db.batch([note, card, noteDeck]);
    return await db.get(UserCard).find(generatedCardId);
  });
}

export async function updateCard(
  db: Database,
  cardId: string,
  front: string,
  back: string,
) {
  return await db.write(async () => {
    const now = Date.now();
    const card = await db.get(UserCard).find(cardId);
    const note = await db.get(UserNote).find(card.note_id);
    if (
      note.note_type !== BASIC_NOTE_TYPE ||
      note.fields_version !== BASIC_NOTE_FIELDS_VERSION ||
      card.template_key !== BASIC_FRONT_BACK_TEMPLATE_KEY
    ) {
      throw new Error('The front/back editor only supports basic notes');
    }
    await db.batch([
      note.prepareUpdate((record) => {
        record.fields_json = JSON.stringify({ front, back });
        record.updated_at = now;
      }),
      card.prepareUpdate((record) => {
        record.front = front;
        record.back = back;
        record.updated_at = now;
      }),
    ]);
    return card;
  });
}

export async function removeNoteFromDeck(
  db: Database,
  noteId: string,
  deckId: string,
) {
  return await db.write(async () => {
    const now = Date.now();
    const memberships = await db
      .get(UserNoteDeck)
      .query(Q.where('note_id', noteId), Q.where('deck_id', deckId))
      .fetch();
    await db.batch(
      memberships.map((membership) =>
        membership.prepareUpdate((record) => {
          record.active = false;
          record.updated_at = now;
        }),
      ),
    );
  });
}

export async function disableCard(db: Database, cardId: string) {
  return await db.write(async () => {
    const now = Date.now();
    const card = await db.get(UserCard).find(cardId);
    return await card.update((record) => {
      record.active = false;
      record.updated_at = now;
    });
  });
}

export async function deleteNote(db: Database, noteId: string) {
  return await db.write(async () => {
    const note = await db.get(UserNote).find(noteId);
    const cards = await db
      .get(UserCard)
      .query(Q.where('note_id', noteId))
      .fetch();
    const cardIds = cards.map((sibling) => sibling.id);
    const noteDecks = await db
      .get(UserNoteDeck)
      .query(Q.where('note_id', noteId))
      .fetch();
    const reviews = cardIds.length
      ? await db
          .get(ReviewEvent)
          .query(Q.where('user_card_id', Q.oneOf(cardIds)))
          .fetch()
      : [];
    await db.batch([
      ...reviews.map((review) => review.prepareMarkAsDeleted()),
      ...cards.map((sibling) => sibling.prepareMarkAsDeleted()),
      ...noteDecks.map((noteDeck) => noteDeck.prepareMarkAsDeleted()),
      note.prepareMarkAsDeleted(),
    ]);
  });
}

export async function recordReviewEvent(
  db: Database,
  cardId: string,
  rating: number,
) {
  return await db.write(async () => {
    const now = Date.now();
    const card = await db.get(UserCard).find(cardId);
    const schedule = calculateReviewSchedule(
      card.scheduled_interval_minutes,
      rating,
      now,
    );
    const reviewId = randomId();
    const cardUpdate = card.prepareUpdate((record) => {
      record.scheduled_interval_minutes = schedule.scheduled_interval_minutes;
      record.due_at = schedule.due_at;
      record.updated_at = now;
    });
    const review = db.get(ReviewEvent).prepareCreate({
      id: reviewId,
      user_card_id: cardId,
      rating,
      reviewed_at: now,
    });
    await db.batch([cardUpdate, review]);
    return await db.get(ReviewEvent).find(reviewId);
  });
}

export async function createUserProfile(
  db: Database,
  profile: {
    id: string;
    username: string;
    native_language_id: string;
    target_language_id: string;
  },
) {
  // Check if the profile already exists to prevent primary key constraint violations
  const existing = await db
    .get(UserProfile)
    .query(Q.where('id', profile.id))
    .fetch();

  if (existing.length > 0) {
    return await updateUserProfile(db, profile);
  }

  return await db.write(async () => {
    return await db.get(UserProfile).create({
      id: profile.id,
      username: profile.username,
      bio: null,
      avatar_file_id: null,
      native_language_id: profile.native_language_id,
      target_language_id: profile.target_language_id,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
  });
}

export async function updateUserProfile(
  db: Database,
  profile: {
    username: string;
    native_language_id: string;
    target_language_id: string;
  },
) {
  return await db.write(async () => {
    const profiles = await db.get(UserProfile).query().fetch();
    const existing = profiles[0];
    return await existing.update((record) => {
      record.username = profile.username;
      record.native_language_id = profile.native_language_id;
      record.target_language_id = profile.target_language_id;
      record.updated_at = Date.now();
    });
  });
}

export interface CreateCardInput {
  front: string;
  back: string;
}

export interface CreateCardsBatchOptions {
  deckIdOrTitle: string;
  isNew: boolean;
  description?: string | null;
  cards: CreateCardInput[];
}

export async function createCardsBatch(
  db: Database,
  options: CreateCardsBatchOptions,
) {
  return await db.write(async () => {
    const now = Date.now();
    let targetDeckId: string;
    const batchOperations: BatchOperation[] = [];

    if (options.isNew) {
      targetDeckId = randomId();
      const newDeck = db.get(UserDeck).prepareCreate({
        id: targetDeckId,
        title: options.deckIdOrTitle,
        description: options.description || null,
        created_at: now,
        updated_at: now,
      });
      batchOperations.push(newDeck);
    } else {
      targetDeckId = options.deckIdOrTitle;
    }

    for (const cardInput of options.cards) {
      const noteId = randomId();
      const templateKey = BASIC_FRONT_BACK_TEMPLATE_KEY;
      const generatedCardId = cardId(noteId, templateKey);
      const membershipId = noteDeckId(noteId, targetDeckId);

      const note = db.get(UserNote).prepareCreate({
        id: noteId,
        note_type: BASIC_NOTE_TYPE,
        fields_version: BASIC_NOTE_FIELDS_VERSION,
        fields_json: JSON.stringify({
          front: cardInput.front,
          back: cardInput.back,
        }),
        additional_content: null,
        created_at: now,
        updated_at: now,
      });

      const card = db.get(UserCard).prepareCreate({
        id: generatedCardId,
        note_id: noteId,
        template_key: templateKey,
        active: true,
        front: cardInput.front,
        back: cardInput.back,
        due_at: now,
        scheduled_interval_minutes: 0,
        created_at: now,
        updated_at: now,
      });

      const noteDeck = db.get(UserNoteDeck).prepareCreate({
        id: membershipId,
        note_id: noteId,
        deck_id: targetDeckId,
        active: true,
        created_at: now,
        updated_at: now,
      });

      batchOperations.push(note, card, noteDeck);
    }

    await db.batch(batchOperations);
    return targetDeckId;
  });
}


