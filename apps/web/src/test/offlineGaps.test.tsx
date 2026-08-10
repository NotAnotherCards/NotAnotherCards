/**
 * Failing tests for two gaps in the offline store wiring. Both run against a
 * real in-memory SQLite database (@remelondb/driver-node), so they exercise
 * the actual query and write paths, not mocks.
 *
 * 1. The due-cards list never picks up cards that become due while the app
 *    is open: getDueCardsQuery captures Date.now() once, and useStore only
 *    rebuilds the query when the db instance changes.
 * 2. Deleting a deck soft-deletes its cards but leaves their review events
 *    behind, so the review history keeps rows whose cards no longer exist.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  Database,
  fetchLocalChanges,
  markLocalChangesAsSynced,
} from "@remelondb/core";
import { NodeSqliteDriver } from "@remelondb/driver-node";
import { schema, UserDeck, UserCard, ReviewEvent } from "@repo/offline-db";
import { useStore } from "@/hooks/useStore";
import {
  createDeck,
  createCard,
  recordReviewEvent,
  deleteDeck,
  getReviewHistoryQuery,
} from "@/offline/queries";

vi.mock("../offline/db", async () => {
  const { createDatabaseManager, Database } = await import("@remelondb/core");
  const { NodeSqliteDriver } = await import("@remelondb/driver-node");
  const { schema, UserDeck, UserCard, ReviewEvent } = await import(
    "@repo/offline-db"
  );
  const manager = createDatabaseManager({
    open: () =>
      Database.open({
        driver: new NodeSqliteDriver(),
        schema,
        modelClasses: [UserDeck, UserCard, ReviewEvent],
        name: ":memory:",
      }),
  });
  return { manager };
});

describe("due-cards reactivity", () => {
  beforeEach(() => {
    // Fake only Date so vi.setSystemTime works; timers stay real for waitFor.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-06T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a card again once its 'Again' interval has elapsed", async () => {
    const { result, rerender } = renderHook(() => useStore());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    let deckId = "";
    let cardId = "";
    await act(async () => {
      const deck = await result.current.createDeck("Deck", "");
      deckId = deck.id;
      const card = await result.current.createCard(deckId, "front", "back");
      cardId = card.id;
    });

    // The freshly created card is due immediately.
    await waitFor(() =>
      expect(result.current.dueCards.map((c) => c.id)).toContain(cardId),
    );

    // Rate it "Again" -> due again five minutes from now.
    await act(async () => {
      await result.current.recordReview(cardId, 1);
    });
    await waitFor(() => expect(result.current.dueCards).toHaveLength(0));

    // Six minutes pass while the app stays open.
    vi.setSystemTime(Date.now() + 6 * 60_000);
    rerender();

    // Intended behavior: the card is due again and reappears without a page
    // reload. Currently the query keeps the Date.now() captured at build
    // time, so this times out.
    await waitFor(
      () => expect(result.current.dueCards.map((c) => c.id)).toContain(cardId),
      { timeout: 2000 },
    );
  });
});

describe("deck deletion on the wire", () => {
  it("ships a deck deletion as a protocol delete, not an update", async () => {
    const db = await Database.open({
      driver: new NodeSqliteDriver(),
      schema,
      modelClasses: [UserDeck, UserCard, ReviewEvent],
      name: ":memory:",
    });

    const deck = await createDeck(db, "Deck");

    // Simulate a completed push so the deck is in synced state - deletions
    // of never-synced records don't need a tombstone.
    const localChanges = await fetchLocalChanges(db);
    await db.write(async () => {
      await markLocalChangesAsSynced(db, localChanges);
    });

    await deleteDeck(db, deck.id);

    // Intended behavior: the deletion lands in the wire `deleted` list, so
    // the server writes a tombstone. Writing deleted_at as an app column
    // makes it an `updated` entry instead - the server would upsert the
    // deck alive again and every device would resurrect it on the next
    // pull.
    const { changes } = await fetchLocalChanges(db);
    expect(changes.user_decks.deleted).toContain(deck.id);
    expect(changes.user_decks.updated.map((r) => r.id)).not.toContain(deck.id);


  });
});

describe("deck deletion cascade", () => {
  it("removes the deck's review history along with its cards", async () => {
    const db = await Database.open({
      driver: new NodeSqliteDriver(),
      schema,
      modelClasses: [UserDeck, UserCard, ReviewEvent],
      name: ":memory:",
    });

    const deck = await createDeck(db, "Deck");
    const card = await createCard(db, deck.id, "front", "back");
    await recordReviewEvent(db, card.id, 3);

    await deleteDeck(db, deck.id);

    // Intended behavior: no review events survive whose card was deleted by
    // the cascade. Currently deleteDeck only touches the deck and its cards,
    // so the review row stays behind, referencing a deleted card.
    const orphaned = await getReviewHistoryQuery(db).fetch();
    expect(orphaned).toHaveLength(0);


  });
});
