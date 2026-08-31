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
  BASIC_FRONT_BACK_TEMPLATE_KEY,
  BASIC_NOTE_FIELDS_VERSION,
  BASIC_NOTE_TYPE,
  cardId,
  noteDeckId,
} from '@repo/offline-db';

describe('deterministic offline IDs', () => {
  it.each([
    [
      'user card',
      cardId,
      'note-123',
      'front-back',
      'db1cd149-906b-5c3c-a848-460f9a72773c',
    ],
    [
      'note-deck membership',
      noteDeckId,
      'note-123',
      'deck-456',
      '64222a0f-3a7f-51a4-97d9-05ae44a1ca59',
    ],
  ])(
    'pins the %s sync protocol vector',
    (_label, deriveId, first, second, expected) => {
      expect(deriveId(first, second)).toBe(expected);
    },
  );
});

describe('@repo/offline-db wiring on web', () => {
  it('imports and validates offline db schemas', () => {
    expect({
      noteType: BASIC_NOTE_TYPE,
      fieldsVersion: BASIC_NOTE_FIELDS_VERSION,
      templateKey: BASIC_FRONT_BACK_TEMPLATE_KEY,
    }).toEqual({
      noteType: 'basic',
      fieldsVersion: 1,
      templateKey: 'front-back',
    });
    expect(schema.version).toBe(3);
    expect(schema.tables.user_cards).toBeDefined();
    expect(schema.tables.user_decks).toBeDefined();
    expect(schema.tables.user_notes).toBeDefined();
    expect(schema.tables.user_note_decks).toBeDefined();
    expect(schema.tables.review_events).toBeDefined();
    expect(schema.tables.user_profiles).toBeDefined();

    const cardRow = {
      note_id: 'note123',
      template_key: 'front-back',
      active: true,
      front: 'front side',
      back: 'back side',
      due_at: 0,
      scheduled_interval_minutes: 0,
      created_at: 0,
      updated_at: 0,
    };
    expect(UserCardRow.parse(cardRow)).toEqual(cardRow);
    const wireCardRow = { id: 'card123', ...cardRow };
    expect(syncWireSchemas.rows.user_cards.parse(wireCardRow)).toEqual(
      wireCardRow,
    );
    expect(
      UserCardRow.safeParse({
        ...cardRow,
        scheduled_interval_minutes: -1,
      }).success,
    ).toBe(false);
    const cardWithoutInterval: Partial<typeof cardRow> = { ...cardRow };
    delete cardWithoutInterval.scheduled_interval_minutes;
    expect(UserCardRow.safeParse(cardWithoutInterval).success).toBe(false);

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
        fields_json: JSON.stringify({
          original_language: 'de',
          translation_language: 'en',
          original: 'Hund',
          translation: 'dog',
        }),
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
