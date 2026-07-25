import { describe, expect, it } from "vitest";
import { UserCardRow, CardRow, WordCardRow, syncWireSchemas, schema } from "@repo/offline-db";

describe("@repo/offline-db wiring on web", () => {
  it("imports and validates offline db schemas", () => {
    expect(schema.version).toBe(1);
    expect(schema.tables.user_cards).toBeDefined();

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
  });
});
