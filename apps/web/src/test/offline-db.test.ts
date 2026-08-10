import { describe, expect, it } from "vitest";
import {
  UserCardRow,
  syncWireSchemas,
  schema,
  UserDeckRow,
  ReviewEventRow,
} from "@repo/offline-db";

describe("@repo/offline-db wiring on web", () => {
  it("imports and validates offline db schemas", () => {
    expect(schema.version).toBe(1);
    expect(schema.tables.user_cards).toBeDefined();
    expect(schema.tables.user_decks).toBeDefined();
    expect(schema.tables.review_events).toBeDefined();

    expect(
      UserCardRow.safeParse({
        deck_id: "deck123",
        front: "front side",
        back: "back side",
        due_at: 0,
        created_at: 0,
        updated_at: 0,
      }).success,
    ).toBe(true);

    expect(
      UserDeckRow.safeParse({
        title: "Test Deck",
        description: "Deck description",
        created_at: 0,
        updated_at: 0,
      }).success,
    ).toBe(true);

    expect(
      ReviewEventRow.safeParse({
        user_card_id: "usercard123",
        rating: 3,
        reviewed_at: 0,
      }).success,
    ).toBe(true);

    expect(syncWireSchemas.rows.user_cards).toBeDefined();
    expect(syncWireSchemas.rows.user_decks).toBeDefined();
    expect(syncWireSchemas.rows.review_events).toBeDefined();
  });
});
