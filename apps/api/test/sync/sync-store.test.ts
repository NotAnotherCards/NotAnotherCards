import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import type {
  SyncChanges,
  SyncPullResult,
  SyncPushArgs,
} from '@remelondb/core';
import {
  BASIC_FRONT_BACK_TEMPLATE_KEY,
  BASIC_NOTE_FIELDS_VERSION,
  BASIC_NOTE_TYPE,
  cardId,
  noteDeckId,
  WORD_NOTE_FIELDS_VERSION,
  WORD_NOTE_TYPE,
} from '@repo/offline-db';
import { LANGUAGES } from '@repo/schemas';
import {
  accepted,
  pulled,
  registerServerConformance,
} from '@remelondb/server/conformance';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  databaseSchema,
  type AppDatabase,
} from '../../src/database/database-schema';
import { runTombstoneGc } from '../../src/sync/retention';
import {
  createAppSyncEngine,
  createAppSyncStore,
  type AppSyncStore,
} from '../../src/sync/sync-store';
import { userProfiles } from '../../src/sync/schema';
import {
  db,
  getTestConnectionString,
  hasPostgres,
  resetPostgres,
  setUpPostgres,
  tearDownPostgres,
} from './postgres-fixture';

const pullArgs = (cursor: string | null) => ({
  cursor,
  schemaVersion: 1,
  migration: null,
});

let nextId = 0;
const id = (prefix: string): string => `${prefix}-${++nextId}`;

if (hasPostgres) {
  beforeAll(setUpPostgres, 30_000);
  beforeEach(resetPostgres);
  afterAll(tearDownPostgres, 30_000);

  registerServerConformance({
    name: 'NotAnotherCards PostgreSQL Drizzle store',
    makeContext: () => {
      const engine = createAppSyncEngine(createAppSyncStore(db));
      return Promise.resolve({
        handlers: engine.as('user-a'),
        secondUser: engine.as('user-b'),
        concurrently: async (
          pull: () => Promise<SyncPullResult>,
          write: () => Promise<void>,
        ) => {
          const pulling = pull();
          await write();
          return pulling;
        },
      });
    },
    fixtures: {
      user_decks: {
        validRow: () => ({
          id: id('deck'),
          title: 'German',
          description: null,
          note_type: 'basic',
          native_language_id: null,
          target_language_id: null,
          created_at: Date.now(),
          updated_at: Date.now(),
        }),
        mutate: (row) => ({
          ...row,
          title: `${String(row.title)} edited`,
          updated_at: Date.now(),
        }),
        invalidRow: () => ({
          id: id('invalid-deck'),
          title: '',
          description: null,
          note_type: 'basic',
          native_language_id: null,
          target_language_id: null,
          created_at: Date.now(),
          updated_at: Date.now(),
        }),
      },
    },
  });
} else {
  describe.skip('PostgreSQL remelonDB sync integration', () => {
    it('requires DATABASE_URL or TEST_DATABASE_URL', () => undefined);
  });
}

const modelIds = (suffix = '1') => {
  const deck = `deck-${suffix}`;
  const note = `note-${suffix}`;
  return {
    deck,
    note,
    card: cardId(note, BASIC_FRONT_BACK_TEMPLATE_KEY),
    membership: noteDeckId(note, deck),
    review: `review-${suffix}`,
  };
};

const allTablesCreated = (now: number, suffix = '1'): SyncChanges => {
  const ids = modelIds(suffix);
  return {
    user_decks: {
      created: [
        {
          id: ids.deck,
          title: `Private deck ${suffix}`,
          description: 'Sensitive description',
          note_type: 'basic',
          native_language_id: null,
          target_language_id: null,
          created_at: now,
          updated_at: now,
        },
      ],
      updated: [],
      deleted: [],
    },
    user_notes: {
      created: [
        {
          id: ids.note,
          note_type: BASIC_NOTE_TYPE,
          fields_version: BASIC_NOTE_FIELDS_VERSION,
          // the same-push card below must carry exactly these values:
          // the server rejects a card that contradicts its note (#194)
          fields_json: JSON.stringify({
            front: 'secret front',
            back: 'secret back',
          }),
          additional_content: 'Sensitive additional content',
          created_at: now,
          updated_at: now,
        },
      ],
      updated: [],
      deleted: [],
    },
    user_cards: {
      created: [
        {
          id: ids.card,
          note_id: ids.note,
          template_key: BASIC_FRONT_BACK_TEMPLATE_KEY,
          active: true,
          front: 'secret front',
          back: 'secret back',
          due_at: now,
          scheduled_interval_minutes: 0,
          created_at: now,
          updated_at: now,
        },
      ],
      updated: [],
      deleted: [],
    },
    user_note_decks: {
      created: [
        {
          id: ids.membership,
          note_id: ids.note,
          deck_id: ids.deck,
          active: true,
          created_at: now,
          updated_at: now,
        },
      ],
      updated: [],
      deleted: [],
    },
    review_events: {
      created: [
        {
          id: ids.review,
          user_card_id: ids.card,
          rating: 3,
          reviewed_at: now,
        },
      ],
      updated: [],
      deleted: [],
    },
  };
};

const describePostgres = hasPostgres ? describe : describe.skip;

describePostgres('PostgreSQL-backed sync behavior', () => {
  it('enforces unique profile usernames but permits multiple null usernames', async () => {
    const now = Date.now();
    await db.insert(userProfiles).values([
      {
        userId: 'user-a',
        rev: 1,
        username: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        userId: 'user-b',
        rev: 2,
        username: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await db
      .update(userProfiles)
      .set({ username: 'shared-name' })
      .where(eq(userProfiles.userId, 'user-a'));
    await expect(
      db
        .update(userProfiles)
        .set({ username: 'shared-name' })
        .where(eq(userProfiles.userId, 'user-b')),
    ).rejects.toMatchObject({
      cause: {
        code: '23505',
        constraint: 'user_profiles_username_unique',
      },
    });
  });

  it('round-trips a one-to-one profile and rejects a foreign profile id', async () => {
    const now = Date.now();
    const handlers = createAppSyncEngine(createAppSyncStore(db)).as('user-a');
    const start = pulled(await handlers.pull(pullArgs(null)));
    const profile = {
      username: 'alice',
      bio: 'Learning German',
      avatar_file_id: null,
      native_language_id: null,
      target_language_id: null,
      created_at: now,
      updated_at: now,
    };

    const result = accepted(
      await handlers.push({
        cursor: start.cursor,
        changes: {
          user_profiles: {
            created: [
              { id: 'user-a', ...profile },
              { id: 'user-b', ...profile, username: 'not-alice' },
            ],
            updated: [],
            deleted: [],
          },
        },
      }),
    );

    expect(result.rejected?.user_profiles).toEqual(['user-b']);
    const state = pulled(await handlers.pull(pullArgs(null)));
    expect(state.changes.user_profiles?.updated).toEqual([
      expect.objectContaining({ id: 'user-a', username: 'alice' }),
    ]);
  });

  it('rejects duplicate profile usernames and accepts later valid profile syncs', async () => {
    const now = Date.now();
    const engine = createAppSyncEngine(createAppSyncStore(db));
    const userA = engine.as('user-a');
    const userB = engine.as('user-b');
    const profile = (username: string | null, updatedAt: number) => ({
      username,
      bio: null,
      avatar_file_id: null,
      native_language_id: null,
      target_language_id: null,
      created_at: now,
      updated_at: updatedAt,
    });

    const startA = pulled(await userA.pull(pullArgs(null)));
    const startB = pulled(await userB.pull(pullArgs(null)));
    const nullA = accepted(
      await userA.push({
        cursor: startA.cursor,
        changes: {
          user_profiles: {
            created: [{ id: 'user-a', ...profile(null, now) }],
            updated: [],
            deleted: [],
          },
        },
      }),
    );
    const nullB = accepted(
      await userB.push({
        cursor: startB.cursor,
        changes: {
          user_profiles: {
            created: [{ id: 'user-b', ...profile(null, now) }],
            updated: [],
            deleted: [],
          },
        },
      }),
    );

    expect(nullA.rejected?.user_profiles ?? []).toEqual([]);
    expect(nullB.rejected?.user_profiles ?? []).toEqual([]);

    const namedA = accepted(
      await userA.push({
        cursor: nullA.cursor!,
        changes: {
          user_profiles: {
            created: [],
            updated: [{ id: 'user-a', ...profile('alice', now + 1) }],
            deleted: [],
          },
        },
      }),
    );
    const unchangedA = accepted(
      await userA.push({
        cursor: namedA.cursor!,
        changes: {
          user_profiles: {
            created: [],
            updated: [{ id: 'user-a', ...profile('alice', now + 2) }],
            deleted: [],
          },
        },
      }),
    );

    expect(unchangedA.rejected?.user_profiles ?? []).toEqual([]);

    const duplicateB = accepted(
      await userB.push({
        cursor: nullB.cursor!,
        changes: {
          user_profiles: {
            created: [],
            updated: [{ id: 'user-b', ...profile('alice', now + 3) }],
            deleted: [],
          },
        },
      }),
    );

    expect(duplicateB.rejected?.user_profiles).toEqual(['user-b']);
    const afterRejection = accepted(
      await userB.push({
        cursor: duplicateB.cursor!,
        changes: {
          user_profiles: {
            created: [],
            updated: [{ id: 'user-b', ...profile('bob', now + 4) }],
            deleted: [],
          },
        },
      }),
    );

    expect(afterRejection.rejected?.user_profiles ?? []).toEqual([]);
    const profiles = await db
      .select({ userId: userProfiles.userId, username: userProfiles.username })
      .from(userProfiles);
    expect(profiles).toEqual(
      expect.arrayContaining([
        { userId: 'user-a', username: 'alice' },
        { userId: 'user-b', username: 'bob' },
      ]),
    );
  });

  it('releases a username when the profile is tombstoned', async () => {
    const now = Date.now();
    const engine = createAppSyncEngine(createAppSyncStore(db));
    const userA = engine.as('user-a');
    const userB = engine.as('user-b');
    const profile = (username: string | null, updatedAt: number) => ({
      username,
      bio: null,
      avatar_file_id: null,
      native_language_id: null,
      target_language_id: null,
      created_at: now,
      updated_at: updatedAt,
    });

    const startA = pulled(await userA.pull(pullArgs(null)));
    const createdA = accepted(
      await userA.push({
        cursor: startA.cursor,
        changes: {
          user_profiles: {
            created: [{ id: 'user-a', ...profile('alice', now) }],
            updated: [],
            deleted: [],
          },
        },
      }),
    );
    expect(createdA.rejected?.user_profiles ?? []).toEqual([]);

    const deletedA = accepted(
      await userA.push({
        cursor: createdA.cursor!,
        changes: {
          user_profiles: { created: [], updated: [], deleted: ['user-a'] },
        },
      }),
    );
    expect(deletedA.rejected?.user_profiles ?? []).toEqual([]);

    // scrub blanks username in the same stroke as the tombstone, so the
    // unique constraint stops holding the name
    const [tombstoned] = await db
      .select({
        username: userProfiles.username,
        deletedAt: userProfiles.deletedAt,
      })
      .from(userProfiles)
      .where(eq(userProfiles.userId, 'user-a'));
    expect(tombstoned?.username).toBeNull();
    expect(tombstoned?.deletedAt).not.toBeNull();

    const startB = pulled(await userB.pull(pullArgs(null)));
    const claimedB = accepted(
      await userB.push({
        cursor: startB.cursor,
        changes: {
          user_profiles: {
            created: [{ id: 'user-b', ...profile('alice', now + 1) }],
            updated: [],
            deleted: [],
          },
        },
      }),
    );

    expect(claimedB.rejected?.user_profiles ?? []).toEqual([]);
    const [ownerB] = await db
      .select({ username: userProfiles.username })
      .from(userProfiles)
      .where(eq(userProfiles.userId, 'user-b'));
    expect(ownerB?.username).toBe('alice');
  });

  it('round-trips all tables and persists through a fresh backend instance', async () => {
    const now = Date.now();
    const engine = createAppSyncEngine(createAppSyncStore(db));
    const handlers = engine.as('user-a');
    const start = pulled(await handlers.pull(pullArgs(null)));

    accepted(
      await handlers.push({
        cursor: start.cursor,
        changes: allTablesCreated(now),
      }),
    );

    const anotherPool = new Pool({
      connectionString: getTestConnectionString(),
    });
    try {
      const restartedDb = drizzle(anotherPool, {
        schema: databaseSchema,
      }) as AppDatabase;
      const restarted = createAppSyncEngine(createAppSyncStore(restartedDb)).as(
        'user-a',
      );
      const state = pulled(await restarted.pull(pullArgs(null)));

      expect(state.changes.user_decks?.updated).toEqual([
        expect.objectContaining({ id: 'deck-1', created_at: now }),
      ]);
      expect(state.changes.user_notes?.updated).toEqual([
        expect.objectContaining({ id: 'note-1', created_at: now }),
      ]);
      expect(state.changes.user_cards?.updated).toEqual([
        expect.objectContaining({ id: modelIds().card, due_at: now }),
      ]);
      expect(state.changes.user_note_decks?.updated).toEqual([
        expect.objectContaining({ id: modelIds().membership }),
      ]);
      expect(state.changes.review_events?.updated).toEqual([
        expect.objectContaining({ id: 'review-1', reviewed_at: now }),
      ]);
    } finally {
      await anotherPool.end();
    }
  });

  it('round-trips card updates while preserving insert-only creation time', async () => {
    const now = Date.now();
    const handlers = createAppSyncEngine(createAppSyncStore(db)).as('user-a');
    const start = pulled(await handlers.pull(pullArgs(null)));
    accepted(
      await handlers.push({
        cursor: start.cursor,
        changes: allTablesCreated(now),
      }),
    );
    const seeded = pulled(await handlers.pull(pullArgs(null)));

    accepted(
      await handlers.push({
        cursor: seeded.cursor,
        changes: {
          user_cards: {
            created: [],
            updated: [
              {
                id: modelIds().card,
                note_id: 'note-1',
                template_key: BASIC_FRONT_BACK_TEMPLATE_KEY,
                active: true,
                front: 'updated front',
                back: 'updated back',
                due_at: now + 10_000,
                scheduled_interval_minutes: 10,
                created_at: now + 20_000,
                updated_at: now + 30_000,
              },
            ],
            deleted: [],
          },
        },
      }),
    );

    const incremental = pulled(await handlers.pull(pullArgs(seeded.cursor)));
    expect(incremental.changes.user_cards?.updated).toEqual([
      expect.objectContaining({
        id: modelIds().card,
        front: 'updated front',
        back: 'updated back',
        due_at: now + 10_000,
        created_at: now,
        updated_at: now + 30_000,
      }),
    ]);
  });

  it('isolates every configured table between two user scopes', async () => {
    const now = Date.now();
    const idsA = modelIds('a');
    const idsB = modelIds('b');
    const engine = createAppSyncEngine(createAppSyncStore(db));
    const userA = engine.as('user-a');
    const userB = engine.as('user-b');
    const startA = pulled(await userA.pull(pullArgs(null)));
    const startB = pulled(await userB.pull(pullArgs(null)));

    accepted(
      await userA.push({
        cursor: startA.cursor,
        changes: allTablesCreated(now, 'a'),
      }),
    );
    accepted(
      await userB.push({
        cursor: startB.cursor,
        changes: allTablesCreated(now + 1, 'b'),
      }),
    );

    const stateA = pulled(await userA.pull(pullArgs(null)));
    const stateB = pulled(await userB.pull(pullArgs(null)));
    expect(stateA.changes.user_decks?.updated.map((row) => row.id)).toEqual([
      idsA.deck,
    ]);
    expect(stateA.changes.user_notes?.updated.map((row) => row.id)).toEqual([
      idsA.note,
    ]);
    expect(stateA.changes.user_cards?.updated.map((row) => row.id)).toEqual([
      idsA.card,
    ]);
    expect(
      stateA.changes.user_note_decks?.updated.map((row) => row.id),
    ).toEqual([idsA.membership]);
    expect(stateA.changes.review_events?.updated.map((row) => row.id)).toEqual([
      idsA.review,
    ]);
    expect(stateB.changes.user_decks?.updated.map((row) => row.id)).toEqual([
      idsB.deck,
    ]);
    expect(stateB.changes.user_notes?.updated.map((row) => row.id)).toEqual([
      idsB.note,
    ]);
    expect(stateB.changes.user_cards?.updated.map((row) => row.id)).toEqual([
      idsB.card,
    ]);
    expect(
      stateB.changes.user_note_decks?.updated.map((row) => row.id),
    ).toEqual([idsB.membership]);
    expect(stateB.changes.review_events?.updated.map((row) => row.id)).toEqual([
      idsB.review,
    ]);

    const rejected = accepted(
      await userB.push({
        cursor: stateB.cursor,
        changes: {
          user_decks: {
            created: [],
            updated: [
              {
                id: idsA.deck,
                title: 'stolen deck',
                description: null,
                note_type: 'basic',
                native_language_id: null,
                target_language_id: null,
                created_at: now,
                updated_at: now + 2,
              },
            ],
            deleted: [],
          },
          user_notes: {
            created: [],
            updated: [
              {
                id: idsA.note,
                note_type: BASIC_NOTE_TYPE,
                fields_version: BASIC_NOTE_FIELDS_VERSION,
                fields_json: JSON.stringify({
                  front: 'stolen source',
                  back: 'stolen source',
                }),
                additional_content: null,
                created_at: now,
                updated_at: now + 2,
              },
            ],
            deleted: [],
          },
          user_cards: {
            created: [],
            updated: [
              {
                id: idsA.card,
                note_id: idsA.note,
                template_key: BASIC_FRONT_BACK_TEMPLATE_KEY,
                active: true,
                front: 'stolen front',
                back: 'stolen back',
                due_at: now,
                scheduled_interval_minutes: 0,
                created_at: now,
                updated_at: now + 2,
              },
            ],
            deleted: [],
          },
          user_note_decks: {
            created: [],
            updated: [
              {
                id: idsA.membership,
                note_id: idsA.note,
                deck_id: idsA.deck,
                active: false,
                created_at: now,
                updated_at: now + 2,
              },
            ],
            deleted: [],
          },
          review_events: {
            created: [],
            updated: [
              {
                id: idsA.review,
                user_card_id: idsA.card,
                rating: 1,
                reviewed_at: now,
              },
            ],
            deleted: [],
          },
        },
      }),
    );
    expect(rejected.rejected).toEqual({
      user_decks: [idsA.deck],
      user_notes: [idsA.note],
      user_cards: [idsA.card],
      user_note_decks: [idsA.membership],
      review_events: [idsA.review],
    });

    const unchangedA = pulled(await userA.pull(pullArgs(null)));
    expect(unchangedA.changes.user_decks?.updated[0]).toEqual(
      expect.objectContaining({ id: idsA.deck, title: 'Private deck a' }),
    );
    expect(unchangedA.changes.user_notes?.updated[0]).toEqual(
      expect.objectContaining({ id: idsA.note }),
    );
    expect(unchangedA.changes.user_cards?.updated[0]).toEqual(
      expect.objectContaining({ id: idsA.card, front: 'secret front' }),
    );
    expect(unchangedA.changes.user_note_decks?.updated[0]).toEqual(
      expect.objectContaining({ id: idsA.membership, active: true }),
    );
    expect(unchangedA.changes.review_events?.updated[0]).toEqual(
      expect.objectContaining({ id: idsA.review, rating: 3 }),
    );
  });

  it('rejects review updates instead of silently ignoring them', async () => {
    const now = Date.now();
    const handlers = createAppSyncEngine(createAppSyncStore(db)).as('user-a');
    const start = pulled(await handlers.pull(pullArgs(null)));
    accepted(
      await handlers.push({
        cursor: start.cursor,
        changes: allTablesCreated(now),
      }),
    );
    const seeded = pulled(await handlers.pull(pullArgs(null)));

    const result = accepted(
      await handlers.push({
        cursor: seeded.cursor,
        changes: {
          review_events: {
            created: [],
            updated: [
              {
                id: 'review-1',
                user_card_id: modelIds().card,
                rating: 1,
                reviewed_at: now,
              },
            ],
            deleted: [],
          },
        },
      }),
    );

    expect(result.rejected?.review_events).toEqual(['review-1']);
    const state = pulled(await handlers.pull(pullArgs(null)));
    expect(state.changes.review_events?.updated).toEqual([
      expect.objectContaining({ id: 'review-1', rating: 3 }),
    ]);
  });

  it('enforces deterministic card and membership ids for every live push', async () => {
    const now = Date.now();
    const ids = modelIds();
    const secondIds = modelIds('2');
    const handlers = createAppSyncEngine(createAppSyncStore(db)).as('user-a');
    const start = pulled(await handlers.pull(pullArgs(null)));
    const seeded = accepted(
      await handlers.push({
        cursor: start.cursor,
        changes: allTablesCreated(now),
      }),
    );

    const card = (id: string, noteId: string, templateKey: string) => ({
      id,
      note_id: noteId,
      template_key: templateKey,
      active: true,
      front: 'front',
      back: 'back',
      due_at: now,
      scheduled_interval_minutes: 0,
      created_at: now,
      updated_at: now + 1,
    });
    const membership = (id: string, noteId: string, deckId: string) => ({
      id,
      note_id: noteId,
      deck_id: deckId,
      active: true,
      created_at: now,
      updated_at: now + 1,
    });
    const staleNoteCardId = cardId(ids.note, 'move-template');
    const staleNoteMembershipId = noteDeckId(ids.note, secondIds.deck);

    const result = accepted(
      await handlers.push({
        cursor: seeded.cursor!,
        changes: {
          user_decks: {
            created: [
              {
                id: secondIds.deck,
                title: 'Second deck',
                description: null,
                note_type: 'basic',
                native_language_id: null,
                target_language_id: null,
                created_at: now,
                updated_at: now,
              },
            ],
            updated: [],
            deleted: [],
          },
          user_notes: {
            created: [
              {
                id: secondIds.note,
                note_type: BASIC_NOTE_TYPE,
                fields_version: BASIC_NOTE_FIELDS_VERSION,
                // must match the card() helper's front/back: the server
                // rejects a same-push card that contradicts its note (#194)
                fields_json: JSON.stringify({
                  front: 'front',
                  back: 'back',
                }),
                additional_content: null,
                created_at: now,
                updated_at: now,
              },
            ],
            updated: [],
            deleted: [],
          },
          user_cards: {
            created: [
              card(
                secondIds.card,
                secondIds.note,
                BASIC_FRONT_BACK_TEMPLATE_KEY,
              ),
              card('random-card-id', ids.note, BASIC_FRONT_BACK_TEMPLATE_KEY),
              card(staleNoteCardId, secondIds.note, 'move-template'),
            ],
            updated: [card(ids.card, ids.note, 'changed-template')],
            deleted: [],
          },
          user_note_decks: {
            created: [
              membership(secondIds.membership, secondIds.note, secondIds.deck),
              membership('random-membership-id', ids.note, ids.deck),
              membership(staleNoteMembershipId, secondIds.note, secondIds.deck),
            ],
            updated: [membership(ids.membership, ids.note, secondIds.deck)],
            deleted: [],
          },
        },
      }),
    );

    expect(result.rejected).toEqual({
      user_cards: ['random-card-id', staleNoteCardId, ids.card],
      user_note_decks: [
        'random-membership-id',
        staleNoteMembershipId,
        ids.membership,
      ],
    });
    const state = pulled(await handlers.pull(pullArgs(null)));
    expect(state.changes.user_cards?.updated.map((row) => row.id)).toContain(
      secondIds.card,
    );
    expect(
      state.changes.user_note_decks?.updated.map((row) => row.id),
    ).toContain(secondIds.membership);
  });

  it("rejects new children that reference another user's parents", async () => {
    const now = Date.now();
    const idsA = modelIds('a');
    const engine = createAppSyncEngine(createAppSyncStore(db));
    const userA = engine.as('user-a');
    const userB = engine.as('user-b');
    const startA = pulled(await userA.pull(pullArgs(null)));
    accepted(
      await userA.push({
        cursor: startA.cursor,
        changes: allTablesCreated(now, 'a'),
      }),
    );

    const foreignCardId = cardId(idsA.note, 'foreign-template');
    const ownDeckId = 'deck-b';
    const foreignMembershipId = noteDeckId(idsA.note, ownDeckId);
    const startB = pulled(await userB.pull(pullArgs(null)));
    const rejected = accepted(
      await userB.push({
        cursor: startB.cursor,
        changes: {
          user_decks: {
            created: [
              {
                id: ownDeckId,
                title: 'User B deck',
                description: null,
                note_type: 'basic',
                native_language_id: null,
                target_language_id: null,
                created_at: now,
                updated_at: now,
              },
            ],
            updated: [],
            deleted: [],
          },
          user_cards: {
            created: [
              {
                id: foreignCardId,
                note_id: idsA.note,
                template_key: 'foreign-template',
                active: true,
                front: 'foreign',
                back: 'foreign',
                due_at: now,
                scheduled_interval_minutes: 0,
                created_at: now,
                updated_at: now,
              },
            ],
            updated: [],
            deleted: [],
          },
          user_note_decks: {
            created: [
              {
                id: foreignMembershipId,
                note_id: idsA.note,
                deck_id: ownDeckId,
                active: true,
                created_at: now,
                updated_at: now,
              },
            ],
            updated: [],
            deleted: [],
          },
        },
      }),
    );

    expect(rejected.rejected).toEqual({
      user_cards: [foreignCardId],
      user_note_decks: [foreignMembershipId],
    });
  });

  it('deleting a deck tombstones only memberships and preserves learning progress', async () => {
    const ids = modelIds();
    const now = Date.now();
    const handlers = createAppSyncEngine(createAppSyncStore(db)).as('user-a');
    const start = pulled(await handlers.pull(pullArgs(null)));
    accepted(
      await handlers.push({
        cursor: start.cursor,
        changes: allTablesCreated(now),
      }),
    );
    const seeded = pulled(await handlers.pull(pullArgs(null)));

    const result = accepted(
      await handlers.push({
        cursor: seeded.cursor,
        changes: {
          user_decks: { created: [], updated: [], deleted: ['deck-1'] },
        },
      }),
    );

    expect(result.changes?.user_note_decks?.deleted).toEqual([ids.membership]);
    expect(result.changes?.user_notes?.deleted ?? []).toEqual([]);
    expect(result.changes?.user_cards?.deleted ?? []).toEqual([]);
    expect(result.changes?.review_events?.deleted ?? []).toEqual([]);
    const rows = await db.execute<{
      deck_deleted: boolean;
      membership_deleted: boolean;
      note_active: boolean;
      card_active: boolean;
      review_active: boolean;
      due_at: number;
      scheduled_interval_minutes: number;
    }>(`
      select
        d.deleted_at is not null as deck_deleted,
        nd.deleted_at is not null as membership_deleted,
        n.deleted_at is null as note_active,
        c.deleted_at is null as card_active,
        r.deleted_at is null as review_active,
        c.due_at,
        c.scheduled_interval_minutes
      from user_decks d
      join user_note_decks nd on nd.deck_id = d.id
      join user_notes n on n.id = nd.note_id
      join user_cards c on c.note_id = n.id
      join review_events r on r.user_card_id = c.id
      where d.id = 'deck-1'
    `);
    expect(rows.rows[0]).toEqual({
      deck_deleted: true,
      membership_deleted: true,
      note_active: true,
      card_active: true,
      review_active: true,
      due_at: now,
      scheduled_interval_minutes: 0,
    });
  });

  it('cascades a card tombstone to its review events', async () => {
    const ids = modelIds();
    const handlers = createAppSyncEngine(createAppSyncStore(db)).as('user-a');
    const start = pulled(await handlers.pull(pullArgs(null)));
    accepted(
      await handlers.push({
        cursor: start.cursor,
        changes: allTablesCreated(Date.now()),
      }),
    );
    const seeded = pulled(await handlers.pull(pullArgs(null)));

    const result = accepted(
      await handlers.push({
        cursor: seeded.cursor,
        changes: {
          user_cards: { created: [], updated: [], deleted: [ids.card] },
        },
      }),
    );

    expect(result.changes?.review_events?.deleted).toEqual(['review-1']);
    const rows = await db.execute<{
      deck_active: boolean;
      card_deleted: boolean;
      review_deleted: boolean;
    }>(`
      select
        d.deleted_at is null as deck_active,
        c.deleted_at is not null as card_deleted,
        r.deleted_at is not null as review_deleted
      from user_decks d
      join user_note_decks nd on nd.deck_id = d.id
      join user_cards c on c.note_id = nd.note_id
      join review_events r on r.user_card_id = c.id
      where d.id = 'deck-1'
    `);
    expect(rows.rows[0]).toEqual({
      deck_active: true,
      card_deleted: true,
      review_deleted: true,
    });
  });

  it('rejects a parent delete combined with child creates or updates', async () => {
    const now = Date.now();
    const ids = modelIds();
    const secondIds = modelIds('2');
    const handlers = createAppSyncEngine(createAppSyncStore(db)).as('user-a');
    const start = pulled(await handlers.pull(pullArgs(null)));
    accepted(
      await handlers.push({
        cursor: start.cursor,
        changes: allTablesCreated(now),
      }),
    );
    const seeded = pulled(await handlers.pull(pullArgs(null)));

    const contradictory = accepted(
      await handlers.push({
        cursor: seeded.cursor,
        changes: {
          user_decks: { created: [], updated: [], deleted: ['deck-1'] },
          user_notes: {
            created: [
              {
                id: secondIds.note,
                note_type: BASIC_NOTE_TYPE,
                fields_version: BASIC_NOTE_FIELDS_VERSION,
                fields_json: JSON.stringify({ front: 'new', back: 'new' }),
                additional_content: null,
                created_at: now,
                updated_at: now,
              },
            ],
            updated: [],
            deleted: [],
          },
          user_note_decks: {
            created: [
              {
                id: noteDeckId(secondIds.note, ids.deck),
                note_id: secondIds.note,
                deck_id: ids.deck,
                active: true,
                created_at: now,
                updated_at: now,
              },
            ],
            updated: [
              {
                id: ids.membership,
                note_id: ids.note,
                deck_id: ids.deck,
                active: false,
                created_at: now,
                updated_at: now + 1,
              },
            ],
            deleted: [],
          },
        },
      }),
    );

    expect(contradictory.rejected).toEqual({ user_decks: ['deck-1'] });
    const active = await db.execute<{
      deck_active: boolean;
      memberships: string;
      original_membership_active: boolean;
    }>(`
      select
        d.deleted_at is null as deck_active,
        count(nd.id) filter (where nd.deleted_at is null)::text as memberships,
        bool_or(nd.active) filter (where nd.id = '${ids.membership}') as original_membership_active
      from user_decks d
      left join user_note_decks nd on nd.deck_id = d.id
      where d.id = 'deck-1'
      group by d.id
    `);
    expect(active.rows[0]).toEqual({
      deck_active: true,
      memberships: '2',
      original_membership_active: false,
    });

    const retry = accepted(
      await handlers.push({
        cursor: contradictory.cursor!,
        changes: {
          user_decks: { created: [], updated: [], deleted: ['deck-1'] },
        },
      }),
    );
    expect(new Set(retry.changes?.user_note_decks?.deleted)).toEqual(
      new Set([ids.membership, noteDeckId(secondIds.note, ids.deck)]),
    );
    expect(retry.changes?.user_notes?.deleted ?? []).toEqual([]);
    expect(retry.changes?.user_cards?.deleted ?? []).toEqual([]);
    expect(retry.changes?.review_events?.deleted ?? []).toEqual([]);
  });

  it('cascades note deletes into scrubbed tombstones and serves them incrementally', async () => {
    const ids = modelIds();
    const store = createAppSyncStore(db);
    const handlers = createAppSyncEngine(store).as('user-a');
    const start = pulled(await handlers.pull(pullArgs(null)));
    accepted(
      await handlers.push({
        cursor: start.cursor,
        changes: allTablesCreated(Date.now()),
      }),
    );
    const seeded = pulled(await handlers.pull(pullArgs(null)));
    const revisionsBeforeDelete = await db.execute<{
      table_name: string;
      rev: string;
    }>(`
      select 'user_notes' as table_name, rev::text from user_notes where id = 'note-1'
      union all
      select 'user_cards', rev::text from user_cards where id = '${ids.card}'
      union all
      select 'user_note_decks', rev::text from user_note_decks where id = '${ids.membership}'
      union all
      select 'review_events', rev::text from review_events where id = 'review-1'
    `);

    accepted(
      await handlers.push({
        cursor: seeded.cursor,
        changes: {
          user_notes: { created: [], updated: [], deleted: ['note-1'] },
        },
      }),
    );

    const incremental = pulled(await handlers.pull(pullArgs(seeded.cursor)));
    expect(incremental.changes.user_notes?.deleted).toEqual(['note-1']);
    expect(incremental.changes.user_cards?.deleted).toEqual([ids.card]);
    expect(incremental.changes.user_note_decks?.deleted).toEqual([
      ids.membership,
    ]);
    expect(incremental.changes.review_events?.deleted).toEqual(['review-1']);
    expect(incremental.changes.user_decks?.deleted ?? []).toEqual([]);

    const rows = await db.execute<{
      table_name: string;
      rev: string;
      deleted_at: Date | null;
      fields_json: string | null;
      additional_content: string | null;
      front: string | null;
      back: string | null;
    }>(`
      select
        'user_notes' as table_name,
        rev::text,
        deleted_at,
        fields_json,
        additional_content,
        null::text as front,
        null::text as back
      from user_notes where id = 'note-1'
      union all
      select
        'user_cards', rev::text, deleted_at, null, null, front, back
      from user_cards where id = '${ids.card}'
      union all
      select
        'user_note_decks', rev::text, deleted_at, null, null, null, null
      from user_note_decks where id = '${ids.membership}'
      union all
      select
        'review_events', rev::text, deleted_at, null, null, null, null
      from review_events where id = 'review-1'
    `);
    expect(rows.rows).toHaveLength(4);
    expect(rows.rows.every((row) => row.deleted_at !== null)).toBe(true);
    const previousRevs = new Map(
      revisionsBeforeDelete.rows.map((row) => [
        row.table_name,
        Number(row.rev),
      ]),
    );
    for (const row of rows.rows) {
      expect(Number(row.rev)).toBeGreaterThan(
        previousRevs.get(row.table_name) ?? 0,
      );
    }
    expect(
      rows.rows.find((row) => row.table_name === 'user_notes'),
    ).toMatchObject({
      fields_json: '',
      additional_content: null,
    });
    expect(
      rows.rows.find((row) => row.table_name === 'user_cards'),
    ).toMatchObject({
      front: '',
      back: '',
    });
  });

  it('persists a time-based GC floor and expires older cursors', async () => {
    const { store, crossValidateChanges } = createAppSyncStore(db);
    const handlers = createAppSyncEngine({ store, crossValidateChanges }).as(
      'user-a',
    );
    const start = pulled(await handlers.pull(pullArgs(null)));
    accepted(
      await handlers.push({
        cursor: start.cursor,
        changes: allTablesCreated(Date.now()),
      }),
    );
    const seeded = pulled(await handlers.pull(pullArgs(null)));
    accepted(
      await handlers.push({
        cursor: seeded.cursor,
        changes: {
          user_decks: { created: [], updated: [], deleted: ['deck-1'] },
          user_notes: { created: [], updated: [], deleted: ['note-1'] },
        },
      }),
    );

    const firstRun = await runTombstoneGc({
      db,
      store,
      now: new Date('2026-01-01T00:00:00Z'),
    });
    expect(firstRun.floor).toBeNull();

    const secondRun = await runTombstoneGc({
      db,
      store,
      now: new Date('2026-04-02T00:00:00Z'),
    });
    expect(secondRun.floor).not.toBeNull();
    expect(await handlers.pull(pullArgs(seeded.cursor))).toEqual({
      resyncRequired: true,
    });

    const meta = await db.execute<{ value: string }>(
      `select value from remelon_sync_meta where key = 'gc_floor'`,
    );
    expect(Number(meta.rows[0]?.value)).toBe(secondRun.floor);

    const remainingRows = await db.execute<{ count: string }>(`
      select sum(count)::text as count
      from (
        select count(*) from user_decks
        union all
        select count(*) from user_notes
        union all
        select count(*) from user_cards
        union all
        select count(*) from user_note_decks
        union all
        select count(*) from review_events
      ) synced_rows
    `);
    expect(Number(remainingRows.rows[0]?.count)).toBe(0);
  });

  it('rolls back every row when a push cannot be committed', async () => {
    const { store: durableStore, crossValidateChanges } =
      createAppSyncStore(db);
    const failingStore: AppSyncStore = {
      gc: (floor) => durableStore.gc(floor),
      transaction: (scope, mode, work) =>
        durableStore.transaction(scope, mode, (tx) =>
          work({
            ...tx,
            upsert: async (table, txScope, rows) => {
              await tx.upsert(table, txScope, rows);
              throw new Error('simulated database failure');
            },
          }),
        ),
    };
    const handlers = createAppSyncEngine({
      store: failingStore,
      crossValidateChanges,
    }).as('user-a');
    const start = pulled(await handlers.pull(pullArgs(null)));
    const push: SyncPushArgs = {
      cursor: start.cursor,
      changes: {
        user_decks: allTablesCreated(Date.now()).user_decks,
      },
    };

    await expect(handlers.push(push)).rejects.toThrow(
      'simulated database failure',
    );
    const rows = await db.execute<{ count: string }>(
      `select count(*) as count from user_decks`,
    );
    expect(Number(rows.rows[0]?.count)).toBe(0);
  });

  describe("a deck's note type", () => {
    const languages = {
      native_language_id: LANGUAGES[0].value,
      target_language_id: LANGUAGES[1].value,
    };
    const deckBase = (now: number) => ({
      title: 'Spanish',
      description: null,
      created_at: now,
      updated_at: now,
    });

    const pushDeck = async (
      handlers: ReturnType<ReturnType<typeof createAppSyncEngine>['as']>,
      cursor: string,
      deck: Record<string, unknown>,
    ) =>
      accepted(
        await handlers.push({
          cursor,
          changes: {
            user_decks: { created: [deck], updated: [], deleted: [] },
          },
        }),
      );

    it('refuses a deck whose type nothing is registered for', async () => {
      const now = Date.now();
      const handlers = createAppSyncEngine(createAppSyncStore(db)).as('user-a');
      const start = pulled(await handlers.pull(pullArgs(null)));
      const result = await pushDeck(handlers, start.cursor, {
        id: 'deck-unknown',
        ...deckBase(now),
        note_type: 'cloze',
        native_language_id: null,
        target_language_id: null,
      });
      expect(result.rejected?.user_decks).toEqual(['deck-unknown']);
    });

    it('requires a word deck to carry both languages, and others neither', async () => {
      const now = Date.now();
      const handlers = createAppSyncEngine(createAppSyncStore(db)).as('user-a');
      const start = pulled(await handlers.pull(pullArgs(null)));

      // the column constraint says the same, but raises rather than
      // rejecting this record and applying the rest of the batch
      const half = await pushDeck(handlers, start.cursor, {
        id: 'deck-half',
        ...deckBase(now),
        note_type: WORD_NOTE_TYPE,
        native_language_id: languages.native_language_id,
        target_language_id: null,
      });
      expect(half.rejected?.user_decks).toEqual(['deck-half']);

      const basicWithLanguages = await pushDeck(handlers, start.cursor, {
        id: 'deck-basic-lang',
        ...deckBase(now),
        note_type: BASIC_NOTE_TYPE,
        ...languages,
      });
      expect(basicWithLanguages.rejected?.user_decks).toEqual([
        'deck-basic-lang',
      ]);
    });

    it('refuses a language id nothing can resolve', async () => {
      const now = Date.now();
      const handlers = createAppSyncEngine(createAppSyncStore(db)).as('user-a');
      const start = pulled(await handlers.pull(pullArgs(null)));
      const result = await pushDeck(handlers, start.cursor, {
        id: 'deck-bad-lang',
        ...deckBase(now),
        note_type: WORD_NOTE_TYPE,
        native_language_id: languages.native_language_id,
        target_language_id: '00000000-0000-0000-0000-0000000000ff',
      });
      expect(result.rejected?.user_decks).toEqual(['deck-bad-lang']);
    });

    it("rejects a change to a stored deck's type rather than ignoring it", async () => {
      const now = Date.now();
      const handlers = createAppSyncEngine(createAppSyncStore(db)).as('user-a');
      const start = pulled(await handlers.pull(pullArgs(null)));
      const created = await pushDeck(handlers, start.cursor, {
        id: 'deck-fixed',
        ...deckBase(now),
        note_type: BASIC_NOTE_TYPE,
        native_language_id: null,
        target_language_id: null,
      });
      expect(created.rejected?.user_decks ?? []).toEqual([]);

      // insertOnly alone would keep the stored value and answer success,
      // leaving the client believing a change it never got
      const changed = accepted(
        await handlers.push({
          cursor: created.cursor,
          changes: {
            user_decks: {
              created: [],
              updated: [
                {
                  id: 'deck-fixed',
                  ...deckBase(now),
                  note_type: WORD_NOTE_TYPE,
                  ...languages,
                },
              ],
              deleted: [],
            },
          },
        }),
      );
      expect(changed.rejected?.user_decks).toEqual(['deck-fixed']);
    });

    it('refuses a membership putting a note in a deck of another type', async () => {
      const now = Date.now();
      const handlers = createAppSyncEngine(createAppSyncStore(db)).as('user-a');
      const start = pulled(await handlers.pull(pullArgs(null)));
      const noteId = 'note-word';
      const deckId = 'deck-basic';
      const result = accepted(
        await handlers.push({
          cursor: start.cursor,
          changes: {
            user_decks: {
              created: [
                {
                  id: deckId,
                  ...deckBase(now),
                  note_type: BASIC_NOTE_TYPE,
                  native_language_id: null,
                  target_language_id: null,
                },
              ],
              updated: [],
              deleted: [],
            },
            user_notes: {
              created: [
                {
                  id: noteId,
                  note_type: WORD_NOTE_TYPE,
                  fields_version: WORD_NOTE_FIELDS_VERSION,
                  fields_json: JSON.stringify({
                    word: 'hola',
                    translation: 'hello',
                    ...languages,
                  }),
                  additional_content: null,
                  created_at: now,
                  updated_at: now,
                },
              ],
              updated: [],
              deleted: [],
            },
            user_note_decks: {
              created: [
                {
                  id: noteDeckId(noteId, deckId),
                  note_id: noteId,
                  deck_id: deckId,
                  active: true,
                  created_at: now,
                  updated_at: now,
                },
              ],
              updated: [],
              deleted: [],
            },
          },
        }),
      );
      // the deck and the note are both fine; only the pairing is not
      expect(result.rejected?.user_decks ?? []).toEqual([]);
      expect(result.rejected?.user_notes ?? []).toEqual([]);
      expect(result.rejected?.user_note_decks).toEqual([
        noteDeckId(noteId, deckId),
      ]);
    });
  });
});
