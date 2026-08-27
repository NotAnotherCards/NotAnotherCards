import {
  appSchema,
  column,
  createTable,
  schemaMigrations,
  unsafeExecuteSql,
} from '@remelondb/core';
import { syncSchemas } from '@remelondb/core/zod';
import { z } from 'zod';
import {
  userDecks,
  userNotes,
  userCards,
  userNoteDecks,
  reviewEvents,
  userProfiles,
  UserDeckRow,
  UserNoteRow,
  UserCardRow,
  UserNoteDeckRow,
  ReviewEventRow,
  UserProfileRow,
  validateNoteFieldsJson,
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

const baseSyncWireSchemas = syncSchemas({
  user_decks: UserDeckRow,
  user_notes: UserNoteRow,
  user_cards: UserCardRow,
  user_note_decks: UserNoteDeckRow,
  review_events: ReviewEventRow,
  user_profiles: UserProfileRow,
});

const UserNoteWireRow = z
  .strictObject({ ...UserNoteRow.shape, id: z.string().min(1) })
  .superRefine((row, context) => {
    const result = validateNoteFieldsJson(
      row.note_type,
      row.fields_version,
      row.fields_json,
    );
    if (!result.success) {
      context.addIssue({
        code: 'custom',
        path: ['fields_json'],
        message: result.error,
      });
    }
  });

function validateNoteChanges(changes: unknown, context: z.RefinementCtx): void {
  if (typeof changes !== 'object' || changes === null) return;
  const noteChanges = (changes as Record<string, unknown>)['user_notes'];
  if (typeof noteChanges !== 'object' || noteChanges === null) return;

  for (const operation of ['created', 'updated'] as const) {
    const rows = (noteChanges as Record<string, unknown>)[operation];
    if (!Array.isArray(rows)) continue;
    rows.forEach((row, index) => {
      const result = UserNoteWireRow.safeParse(row);
      if (!result.success) {
        context.addIssue({
          code: 'custom',
          path: ['user_notes', operation, index],
          message: 'Invalid user note row',
        });
      }
    });
  }
}

export const syncWireSchemas = {
  ...baseSyncWireSchemas,
  rows: {
    user_decks: baseSyncWireSchemas.rows.user_decks!,
    user_notes: UserNoteWireRow,
    user_cards: baseSyncWireSchemas.rows.user_cards!,
    user_note_decks: baseSyncWireSchemas.rows.user_note_decks!,
    review_events: baseSyncWireSchemas.rows.review_events!,
    user_profiles: baseSyncWireSchemas.rows.user_profiles!,
  },
  changes: baseSyncWireSchemas.changes.superRefine(validateNoteChanges),
  pullResult: baseSyncWireSchemas.pullResult.superRefine((result, context) => {
    if ('changes' in result) validateNoteChanges(result.changes, context);
  }),
  pushArgs: baseSyncWireSchemas.pushArgs.superRefine((args, context) => {
    validateNoteChanges(args.changes, context);
  }),
  pushResult: baseSyncWireSchemas.pushResult.superRefine((result, context) => {
    if ('changes' in result && result.changes !== null) {
      validateNoteChanges(result.changes, context);
    }
  }),
};

export * from './user-dictionary.js';
export * from './sync-transport.js';
