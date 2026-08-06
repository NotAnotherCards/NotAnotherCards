import { Database, Q } from "@remelondb/core";
import { UserDeck, UserCard, ReviewEvent } from "@repo/offline-db";

// TODO: Fallback userId "user-1" is temporary for Stage 1 offline mode until full session auth integration.

// ==========================================
// QUERIES
// ==========================================

// TODO: Replace "user-1" fallback with authenticated session user ID when auth is integrated
export function getDecksQuery(db: Database, userId: string = "user-1") {
  return db
    .get(UserDeck)
    .query(
      Q.where("user_id", userId),
      Q.where("deleted_at", null),
      Q.sortBy("created_at", Q.desc),
    );
}

export function getDeckDetailQuery(db: Database, deckId: string) {
  return db
    .get(UserDeck)
    .query(Q.where("id", deckId), Q.where("deleted_at", null));
}

// TODO: Replace "user-1" fallback with authenticated session user ID when auth is integrated
export function getPersonalDictionaryQuery(
  db: Database,
  userId: string = "user-1",
) {
  return db
    .get(UserCard)
    .query(
      Q.where("user_id", userId),
      Q.where("deleted_at", null),
      Q.sortBy("created_at", Q.desc),
    );
}

export function getDeckCardsQuery(db: Database, deckId: string) {
  return db
    .get(UserCard)
    .query(
      Q.where("deck_id", deckId),
      Q.where("deleted_at", null),
      Q.sortBy("created_at", Q.desc),
    );
}

// TODO: Replace "user-1" fallback with authenticated session user ID when auth is integrated
export function getDueCardsQuery(
  db: Database,
  userId: string = "user-1",
  now: number = Date.now(),
) {
  return db
    .get(UserCard)
    .query(
      Q.where("user_id", userId),
      Q.where("deleted_at", null),
      Q.where("due_at", Q.lte(now)),
      Q.sortBy("due_at", Q.asc),
    );
}

export function getCardDetailQuery(db: Database, cardId: string) {
  return db
    .get(UserCard)
    .query(Q.where("id", cardId), Q.where("deleted_at", null));
}

// TODO: Replace "user-1" fallback with authenticated session user ID when auth is integrated
export function getReviewHistoryQuery(
  db: Database,
  userId: string = "user-1",
  userCardId?: string,
) {
  if (userCardId) {
    return db
      .get(ReviewEvent)
      .query(
        Q.where("user_id", userId),
        Q.where("user_card_id", userCardId),
        Q.sortBy("reviewed_at", Q.desc),
      );
  }
  return db
    .get(ReviewEvent)
    .query(Q.where("user_id", userId), Q.sortBy("reviewed_at", Q.desc));
}

// ==========================================
// LOCAL WRITES
// ==========================================

// TODO: Replace "user-1" fallback with authenticated session user ID when auth is integrated
export async function createDeck(
  db: Database,
  title: string,
  description?: string | null,
  userId: string = "user-1",
) {
  return await db.write(async () => {
    const now = Date.now();
    return await db.get(UserDeck).create({
      user_id: userId,
      title,
      description: description || null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
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
      .query(Q.where("deck_id", deckId), Q.where("deleted_at", null))
      .fetch();
    for (const card of cards) {
      await card.markAsDeleted()
      const reviews = await db
        .get(ReviewEvent)
        .query(Q.where("user_card_id", card.id))
        .fetch();
      for (const review of reviews) {
        await review.markAsDeleted();
      }
    }
  });
}

// TODO: Replace "user-1" fallback with authenticated session user ID when auth is integrated
export async function createCard(
  db: Database,
  deckId: string,
  front: string,
  back: string,
  userId: string = "user-1",
) {
  return await db.write(async () => {
    const now = Date.now();
    return await db.get(UserCard).create({
      user_id: userId,
      deck_id: deckId,
      front,
      back,
      due_at: now,
      created_at: now,
      updated_at: now,
      deleted_at: null,
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
    await card.markAsDeleted()
    const reviews = await db.get(ReviewEvent).query(Q.where("user_card_id", cardId)).fetch()
    for (const review of reviews) {
      await review.markAsDeleted()
    }
  });
}

// TODO: Replace "user-1" fallback with authenticated session user ID when auth is integrated
export async function recordReviewEvent(
  db: Database,
  cardId: string,
  rating: number,
  userId: string = "user-1",
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
      user_id: userId,
      user_card_id: cardId,
      rating,
      reviewed_at: now,
    });
  });
}
