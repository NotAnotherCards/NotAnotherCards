import { Database, Q } from '@remelondb/core';
import { UserDeck, UserCard, ReviewEvent, UserProfile } from '@repo/offline-db';

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
  return db.get(UserCard).query(Q.sortBy('created_at', Q.desc));
}

export function getDeckCardsQuery(db: Database, deckId: string) {
  return db
    .get(UserCard)
    .query(Q.where('deck_id', deckId), Q.sortBy('created_at', Q.desc));
}

export function getDueCardsQuery(db: Database, now: number = Date.now()) {
  return db
    .get(UserCard)
    .query(Q.where('due_at', Q.lte(now)), Q.sortBy('due_at', Q.asc));
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
    await deck.markAsDeleted();
    const cards = await db
      .get(UserCard)
      .query(Q.where('deck_id', deckId))
      .fetch();
    for (const card of cards) {
      await card.markAsDeleted();
      const reviews = await db
        .get(ReviewEvent)
        .query(Q.where('user_card_id', card.id))
        .fetch();
      for (const review of reviews) {
        await review.markAsDeleted();
      }
    }
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
    return await db.get(UserCard).create({
      deck_id: deckId,
      front,
      back,
      due_at: now,
      created_at: now,
      updated_at: now,
    });
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
    return await card.update((record) => {
      record.front = front;
      record.back = back;
      record.updated_at = now;
    });
  });
}

export async function deleteCard(db: Database, cardId: string) {
  return await db.write(async () => {
    const card = await db.get(UserCard).find(cardId);
    await card.markAsDeleted();
    const reviews = await db
      .get(ReviewEvent)
      .query(Q.where('user_card_id', cardId))
      .fetch();
    for (const review of reviews) {
      await review.markAsDeleted();
    }
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
