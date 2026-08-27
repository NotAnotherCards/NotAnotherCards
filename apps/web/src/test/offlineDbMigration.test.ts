import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appSchema, column, Database, table } from '@remelondb/core';
import { NodeSqliteDriver } from '@remelondb/driver-node';
import {
  migrations,
  ReviewEvent,
  schema,
  UserCard,
  UserDeck,
  UserNote,
  UserNoteDeck,
  UserProfile,
} from '@repo/offline-db';

const legacySchema = appSchema({
  version: 2,
  tables: [
    table('user_decks', {
      title: column.string(),
      description: column.string().optional(),
      created_at: column.number(),
      updated_at: column.number().indexed(),
    }),
    table('user_cards', {
      deck_id: column.string().indexed(),
      front: column.string(),
      back: column.string(),
      due_at: column.number().indexed(),
      created_at: column.number(),
      updated_at: column.number().indexed(),
    }),
    table('review_events', {
      user_card_id: column.string().indexed(),
      rating: column.number(),
      reviewed_at: column.number(),
    }),
    table('user_profiles', {
      username: column.string().optional(),
      bio: column.string().optional(),
      avatar_file_id: column.string().optional(),
      native_language_id: column.string().optional(),
      target_language_id: column.string().optional(),
      created_at: column.number(),
      updated_at: column.number().indexed(),
    }),
  ],
});

describe('offline note/card migration', () => {
  let directory: string | undefined;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
    directory = undefined;
  });

  it('preserves decks while resetting incompatible cards and reviews', async () => {
    directory = await mkdtemp(join(tmpdir(), 'nac-offline-migration-'));
    const name = join(directory, 'user.db');
    const legacy = await Database.open({
      driver: new NodeSqliteDriver(),
      schema: legacySchema,
      name,
    });

    await legacy.write(async () => {
      await legacy.get('user_decks').create({
        id: 'deck-1',
        title: 'Deck',
        description: null,
        created_at: 1,
        updated_at: 1,
      });
      await legacy.get('user_cards').create({
        id: 'card-1',
        deck_id: 'deck-1',
        front: 'front',
        back: 'back',
        due_at: 1,
        created_at: 1,
        updated_at: 1,
      });
      await legacy.get('review_events').create({
        id: 'review-1',
        user_card_id: 'card-1',
        rating: 3,
        reviewed_at: 1,
      });
    });
    await legacy.driver.close();

    const migrated = await Database.open({
      driver: new NodeSqliteDriver(),
      schema,
      migrations,
      modelClasses: [
        UserDeck,
        UserNote,
        UserCard,
        UserNoteDeck,
        ReviewEvent,
        UserProfile,
      ],
      name,
    });

    expect(await migrated.get(UserDeck).query().fetch()).toHaveLength(1);
    expect(await migrated.get(UserNote).query().fetch()).toEqual([]);
    expect(await migrated.get(UserCard).query().fetch()).toEqual([]);
    expect(await migrated.get(UserNoteDeck).query().fetch()).toEqual([]);
    expect(await migrated.get(ReviewEvent).query().fetch()).toEqual([]);
    await migrated.driver.close();
  });
});
