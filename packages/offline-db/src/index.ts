import {
  appSchema,
  column,
  createTable,
  schemaMigrations,
} from '@remelondb/core';
import { syncSchemas } from '@remelondb/core/zod';
import {
  userDecks,
  userCards,
  reviewEvents,
  userProfiles,
  UserDeckRow,
  UserCardRow,
  ReviewEventRow,
  UserProfileRow,
} from './user-dictionary.js';

export const schema = appSchema({
  version: 2,
  tables: [userDecks, userCards, reviewEvents, userProfiles],
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
  ],
});

export const syncWireSchemas = syncSchemas({
  user_decks: UserDeckRow,
  user_cards: UserCardRow,
  review_events: ReviewEventRow,
  user_profiles: UserProfileRow,
});

export * from './user-dictionary.js';
