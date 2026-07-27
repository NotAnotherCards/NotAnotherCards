import { describe, expect, it } from "vitest";
import { UserCardRow, CardRow, WordCardRow, syncWireSchemas, schema, UserRow, SessionRow } from "@repo/offline-db";

describe("@repo/offline-db wiring on web", () => {
  it("imports and validates offline db schemas", () => {
    expect(schema.version).toBe(1);
    expect(schema.tables.user_cards).toBeDefined();
    expect(schema.tables.users).toBeDefined();
    expect(schema.tables.sessions).toBeDefined();

    expect(
      UserRow.safeParse({
        email: "test@example.com",
        email_verified: true,
        name: "Test User",
        username: "testuser",
        image: null,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
      }).success,
    ).toBe(true);

    expect(
      SessionRow.safeParse({
        user_id: "user123",
        token: "token123",
        expires_at: Date.now() + 3600000,
        ip_address: "127.0.0.1",
        user_agent: "Mozilla",
        created_at: Date.now(),
        updated_at: Date.now(),
      }).success,
    ).toBe(true);

    expect(
      UserCardRow.safeParse({
        user_id: "user123",
        card_id: "card123",
        status: "learning",
        source: "manual",
        offline_enabled: false,
        added_at: 0,
        updated_at: 0,
      }).success,
    ).toBe(true);

    expect(
      CardRow.safeParse({
        type: "word",
        language_id: "lang123",
        status: "active",
        source: "manual",
        created_by_user_id: null,
        created_at: 0,
        updated_at: 0,
        deleted_at: null,
        version: 1,
      }).success,
    ).toBe(true);

    expect(
      WordCardRow.safeParse({
        card_id: "card123",
        lemma: "gehen",
        translation: "to go",
        part_of_speech: "verb",
        pronunciation: null,
        frequency_rank: null,
        frequency_label: null,
        etymology: null,
        mnemonic: null,
        notes: null,
        article: null,
        gender: null,
        plural_form: null,
        countability: null,
        verb_forms: null,
      }).success,
    ).toBe(true);

    expect(syncWireSchemas.rows.user_cards).toBeDefined();
    expect(syncWireSchemas.rows.users).toBeDefined();
  });
});

