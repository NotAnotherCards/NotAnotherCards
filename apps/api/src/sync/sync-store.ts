import { createSyncEngine } from '@remelondb/server';
import { and, inArray, isNull } from 'drizzle-orm';
import {
  createDrizzleStore,
  type DrizzleDb,
  type DrizzleStore,
  type DrizzleStoreOptions,
} from '@remelondb/store-drizzle';
import { syncWireSchemas } from '@repo/offline-db';
import type { AppDatabase } from '../database/database-schema';
import { reviewEvents, userCards, userDecks, userProfiles } from './schema';
import {
  createCrossValidateSyncRelationships,
  withSyncCascadingDeletes,
  type ProfileUsernameOwnerLookup,
} from './sync-validation';

export type AppSyncStore = DrizzleStore<string>;

const findProfileUsernameOwnersByStore = new WeakMap<
  AppSyncStore,
  ProfileUsernameOwnerLookup
>();

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
    user_profiles: {
      table: userProfiles,
      id: userProfiles.userId,
      rev: userProfiles.rev,
      deletedAt: userProfiles.deletedAt,
      scope: userProfiles.userId,
      insertOnly: ['created_at'],
      scrub: {
        username: null,
        bio: null,
        avatarFileId: null,
        nativeLanguageId: null,
        targetLanguageId: null,
      },
    },
  } as unknown as DrizzleStoreOptions<string>['tables'];

  const store = withSyncCascadingDeletes(
    createDrizzleStore<string>({ db: db as unknown as DrizzleDb, tables }),
  );

  findProfileUsernameOwnersByStore.set(store, async (usernames) => {
    if (usernames.length === 0) return new Map();
    const profiles = await db
      .select({
        userId: userProfiles.userId,
        username: userProfiles.username,
      })
      .from(userProfiles)
      .where(
        and(
          inArray(userProfiles.username, [...new Set(usernames)]),
          isNull(userProfiles.deletedAt),
        ),
      );
    return new Map(
      profiles.flatMap((profile) =>
        profile.username === null
          ? []
          : [[profile.username, profile.userId] as const],
      ),
    );
  });

  return store;
}

export function createAppCrossValidateChanges(store: AppSyncStore) {
  const findProfileUsernameOwners =
    findProfileUsernameOwnersByStore.get(store) ??
    (() => Promise.resolve(new Map<string, string>()));
  return createCrossValidateSyncRelationships(findProfileUsernameOwners);
}

export function createAppSyncEngine(store: AppSyncStore) {
  return createSyncEngine({
    store,
    crossValidateChanges: createAppCrossValidateChanges(store),
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
      user_profiles: {
        validate: (row) =>
          syncWireSchemas.rows.user_profiles.safeParse(row).success,
      },
    },
  });
}

export function createAppSyncBackend(db: AppDatabase) {
  const store = createAppSyncStore(db);
  return { store, engine: createAppSyncEngine(store) };
}

export type AppSyncEngine = ReturnType<typeof createAppSyncEngine>;
