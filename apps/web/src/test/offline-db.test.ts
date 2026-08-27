import { describe, expect, it } from 'vitest';
import {
  UserCardRow,
  UserNoteRow,
  UserNoteDeckRow,
  syncWireSchemas,
  schema,
  UserDeckRow,
  ReviewEventRow,
  UserProfileRow,
} from '@repo/offline-db';

describe('@repo/offline-db wiring on web', () => {
  it('imports and validates offline db schemas', () => {
    expect(schema.version).toBe(3);
    expect(schema.tables.user_cards).toBeDefined();
    expect(schema.tables.user_decks).toBeDefined();
    expect(schema.tables.user_notes).toBeDefined();
    expect(schema.tables.user_note_decks).toBeDefined();
    expect(schema.tables.review_events).toBeDefined();
    expect(schema.tables.user_profiles).toBeDefined();

    expect(
      UserCardRow.safeParse({
        note_id: 'note123',
        template_key: 'front-back',
        active: true,
        front: 'front side',
        back: 'back side',
        due_at: 0,
        created_at: 0,
        updated_at: 0,
      }).success,
    ).toBe(true);

    expect(
      UserNoteRow.safeParse({
        note_type: 'basic',
        fields_version: 1,
        fields_json: JSON.stringify({ front: 'front', back: 'back' }),
        additional_content: null,
        created_at: 0,
        updated_at: 0,
      }).success,
    ).toBe(true);
    expect(
      UserNoteRow.safeParse({
        note_type: 'word',
        fields_version: 1,
        fields_json: JSON.stringify({ original_language: 'de' }),
        additional_content: null,
        created_at: 0,
        updated_at: 0,
      }).success,
    ).toBe(false);
    expect(
      syncWireSchemas.rows.user_notes.safeParse({
        id: 'note123',
        note_type: 'basic',
        fields_version: 99,
        fields_json: '{"front":"front","back":"back"}',
        additional_content: null,
        created_at: 0,
        updated_at: 0,
      }).success,
    ).toBe(false);
    expect(
      syncWireSchemas.pushArgs.safeParse({
        cursor: '1',
        changes: {
          user_notes: {
            created: [
              {
                id: 'note123',
                note_type: 'basic',
                fields_version: 1,
                fields_json: 'not json',
                additional_content: null,
                created_at: 0,
                updated_at: 0,
              },
            ],
            updated: [],
            deleted: [],
          },
        },
      }).success,
    ).toBe(false);

    expect(
      UserNoteDeckRow.safeParse({
        note_id: 'note123',
        deck_id: 'deck123',
        active: true,
        created_at: 0,
        updated_at: 0,
      }).success,
    ).toBe(true);

    expect(
      UserDeckRow.safeParse({
        title: 'Test Deck',
        description: 'Deck description',
        created_at: 0,
        updated_at: 0,
      }).success,
    ).toBe(true);

    expect(
      ReviewEventRow.safeParse({
        user_card_id: 'usercard123',
        rating: 3,
        reviewed_at: 0,
      }).success,
    ).toBe(true);

    expect(syncWireSchemas.rows.user_cards).toBeDefined();
    expect(syncWireSchemas.rows.user_decks).toBeDefined();
    expect(syncWireSchemas.rows.user_notes).toBeDefined();
    expect(syncWireSchemas.rows.user_note_decks).toBeDefined();
    expect(syncWireSchemas.rows.review_events).toBeDefined();
    expect(syncWireSchemas.rows.user_profiles).toBeDefined();
    expect(
      UserProfileRow.safeParse({
        username: null,
        bio: null,
        avatar_file_id: null,
        native_language_id: null,
        target_language_id: null,
        created_at: 0,
        updated_at: 0,
      }).success,
    ).toBe(true);
  });
});
