import {
  appSchema,
  column,
  createTable,
  schemaMigrations,
  unsafeExecuteSql,
} from '@remelondb/core';
import {
  userDecks,
  userNotes,
  userCards,
  userNoteDecks,
  reviewEvents,
  userProfiles,
} from './user-dictionary.js';

// encodeURIComponent provides UTF-8 bytes in Hermes without relying on the
// TextEncoder global that happens to exist in browsers and Node-based tests.
export function userDbName(userId: string): string {
  const encoded = encodeURIComponent(userId);
  let hex = '';

  for (let index = 0; index < encoded.length; index += 1) {
    if (encoded[index] === '%') {
      hex += encoded.slice(index + 1, index + 3).toLowerCase();
      index += 2;
    } else {
      hex += encoded.charCodeAt(index).toString(16).padStart(2, '0');
    }
  }

  return `user_${hex}.db`;
}

export const schema = appSchema({
  version: 3,
  tables: [
    userDecks,
    userNotes,
    userCards,
    userNoteDecks,
    reviewEvents,
    userProfiles,
  ],
});

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        createTable({
          name: 'user_profiles',
          columns: {
            username: column.string().optional(),
            bio: column.string().optional(),
            avatar_file_id: column.string().optional(),
            native_language_id: column.string().optional(),
            target_language_id: column.string().optional(),
            created_at: column.number(),
            updated_at: column.number().indexed(),
          },
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        // v2 cards cannot be attached to the new note model. They have a
        // deck_id but no note_id. These are the immutable v2 physical table
        // names; future renames must not rewrite this migration history
        unsafeExecuteSql('drop table "review_events"'),
        unsafeExecuteSql('drop table "user_cards"'),
        createTable({
          name: 'user_notes',
          columns: {
            note_type: column.string(),
            fields_version: column.number(),
            fields_json: column.string(),
            additional_content: column.string().optional(),
            created_at: column.number(),
            updated_at: column.number().indexed(),
          },
        }),
        createTable({
          name: 'user_cards',
          columns: {
            note_id: column.string().indexed(),
            template_key: column.string(),
            active: column.boolean(),
            front: column.string(),
            back: column.string(),
            due_at: column.number().indexed(),
            scheduled_interval_minutes: column.number(),
            created_at: column.number(),
            updated_at: column.number().indexed(),
          },
        }),
        createTable({
          name: 'user_note_decks',
          columns: {
            note_id: column.string().indexed(),
            deck_id: column.string().indexed(),
            active: column.boolean(),
            created_at: column.number(),
            updated_at: column.number().indexed(),
          },
        }),
        createTable({
          name: 'review_events',
          columns: {
            user_card_id: column.string().indexed(),
            rating: column.number(),
            reviewed_at: column.number(),
          },
        }),
      ],
    },
  ],
});

export * from './user-dictionary.js';
export * from './note-registry.js';
export * from './ids.js';
export * from './note-constants.js';
export * from './review-scheduler.js';
export * from './sync-schemas.js';
export * from './sync-transport.js';
export * from './queries.js';
