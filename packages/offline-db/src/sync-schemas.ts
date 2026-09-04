import { syncSchemas } from '@remelondb/core/zod';
import { z } from 'zod';
import {
  ReviewEventRow,
  UserCardRow,
  UserDeckRow,
  UserNoteDeckRow,
  UserNoteRow,
  UserProfileRow,
} from './user-dictionary.js';
import { validateNoteFieldsJson } from './note-registry.js';

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
