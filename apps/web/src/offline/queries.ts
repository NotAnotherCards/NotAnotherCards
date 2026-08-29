import { Database, Q, randomId } from '@remelondb/core';
import {
  UserDeck,
  UserNote,
  UserCard,
  UserNoteDeck,
  ReviewEvent,
  UserProfile,
  cardId,
  noteDeckId,
} from '@repo/offline-db';

// ==========================================
// QUERIES
// ==========================================

export function getDecksQuery(db: Database) {
  return db.get(UserDeck).query(Q.sortBy('created_at', Q.desc));
}

export function getDeckDetailQuery(db: Database, deckId: string) {
  return db.get(UserDeck).query(Q.where('id', deckId));
}

export function getPersonalDictionaryQuery(db: Database) {
  return db
    .get(UserCard)
    .query(Q.where('active', true), Q.sortBy('created_at', Q.desc));
}

export function getDeckCardsQuery(db: Database, deckId: string) {
  return db.get(UserCard).query(
    Q.unsafeSqlQuery(
      `select distinct "user_cards".*
       from "user_cards"
       join "user_note_decks"
         on "user_note_decks"."note_id" = "user_cards"."note_id"
       where "user_note_decks"."deck_id" = ?
         and "user_note_decks"."active" = 1
         and "user_note_decks"."_status" is not 'deleted'
         and "user_cards"."active" = 1
         and "user_cards"."_status" is not 'deleted'
       order by "user_cards"."created_at" desc`,
      [deckId],
    ),
  );
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
    const templateKey = 'front-back';
    const generatedCardId = cardId(noteId, templateKey);
    const membershipId = noteDeckId(noteId, deckId);
    const note = db.get(UserNote).prepareCreate({
      id: noteId,
      note_type: 'basic',
      fields_version: 1,
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

export async function deleteCard(db: Database, cardId: string) {
  return await db.write(async () => {
    const card = await db.get(UserCard).find(cardId);
    const note = await db.get(UserNote).find(card.note_id);
    const cards = await db
      .get(UserCard)
      .query(Q.where('note_id', card.note_id))
      .fetch();
    const cardIds = cards.map((sibling) => sibling.id);
    const noteDecks = await db
      .get(UserNoteDeck)
      .query(Q.where('note_id', card.note_id))
      .fetch();
    const reviews = await db
      .get(ReviewEvent)
      .query(Q.where('user_card_id', Q.oneOf(cardIds)))
      .fetch();
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

    // Spaced Repetition scheduling intervals based on rating (1: Hard/Again, 2: Good, 3: Easy, 4: Mastered)
    const intervals: Record<number, number> = {
      1: 5 * 60 * 1000, // 5 minutes
      2: 24 * 60 * 60 * 1000, // 1 day
      3: 3 * 24 * 60 * 60 * 1000, // 3 days
      4: 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    const nextDue = now + (intervals[rating] || 24 * 60 * 60 * 1000);

    const card = await db.get(UserCard).find(cardId);
    await card.update((record) => {
      record.due_at = nextDue;
      record.updated_at = now;
    });

    return await db.get(ReviewEvent).create({
      user_card_id: cardId,
      rating,
      reviewed_at: now,
    });
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
