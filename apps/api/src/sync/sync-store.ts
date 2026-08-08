import { createSyncEngine } from '@remelondb/server';
import {
  createDrizzleStore,
  type DrizzleDb,
  type DrizzleStore,
  type DrizzleStoreOptions,
} from '@remelondb/store-drizzle';
import { syncWireSchemas } from '@repo/offline-db';
import type { AppDatabase } from '../database/database-schema';
import { reviewEvents, userCards, userDecks } from './schema';
import {
  crossValidateSyncRelationships,
  withSyncRelationshipDeletionPolicy,
} from './sync-validation';

export type AppSyncStore = DrizzleStore<string>;

export function createAppSyncStore(db: AppDatabase): AppSyncStore {
  const tables = {
    user_decks: {
      table: userDecks,
      id: userDecks.id,
      rev: userDecks.rev,
      deletedAt: userDecks.deletedAt,
      scope: userDecks.userId,
      insertOnly: ['created_at'],
      scrub: { title: '', description: null },
    },
    user_cards: {
      table: userCards,
      id: userCards.id,
      rev: userCards.rev,
      deletedAt: userCards.deletedAt,
      scope: userCards.userId,
      insertOnly: ['created_at'],
      scrub: { front: '', back: '' },
    },
    review_events: {
      table: reviewEvents,
      id: reviewEvents.id,
      rev: reviewEvents.rev,
      deletedAt: reviewEvents.deletedAt,
      scope: reviewEvents.userId,
      insertOnly: ['user_card_id', 'rating', 'reviewed_at'],
      scrub: { rating: 1 },
    },
  } as unknown as DrizzleStoreOptions<string>['tables'];

  return withSyncRelationshipDeletionPolicy(
    createDrizzleStore<string>({
      db: db as unknown as DrizzleDb,
      tables,
    }),
  );
}

export function createAppSyncEngine(store: AppSyncStore) {
  return createSyncEngine({
    store,
    crossValidate: crossValidateSyncRelationships,
    tables: {
      user_decks: {
        validate: (row) =>
          syncWireSchemas.rows.user_decks.safeParse(row).success,
      },
      user_cards: {
        validate: (row) =>
          syncWireSchemas.rows.user_cards.safeParse(row).success,
      },
      review_events: {
        appendOnly: true,
        validate: (row) =>
          syncWireSchemas.rows.review_events.safeParse(row).success,
      },
    },
  });
}

export function createAppSyncBackend(db: AppDatabase) {
  const store = createAppSyncStore(db);
  return { store, engine: createAppSyncEngine(store) };
}

export type AppSyncEngine = ReturnType<typeof createAppSyncEngine>;
