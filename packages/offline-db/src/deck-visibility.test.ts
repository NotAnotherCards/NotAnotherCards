import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appSchema, column, Database, table } from '@remelondb/core';
import { NodeSqliteDriver } from '@remelondb/driver-node';
import { describe, expect, it } from 'vitest';
import { migrations, schema } from './index.js';
import { createDeck } from './queries.js';
import { UserDeck } from './user-dictionary.js';

describe('deck visibility offline migration', () => {
  it('backfills v4 decks as private and defaults new decks to private', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nac-257-migration-'));
    const name = join(directory, 'user.db');
    let database: Database | undefined;
    try {
      const v4 = appSchema({
        version: 4,
        tables: [
          ...Object.values(schema.tables).filter(
            (t) => t.name !== 'user_decks',
          ),
          table('user_decks', {
            title: column.string(),
            description: column.string().optional(),
            note_type: column.string(),
            native_language_id: column.string().optional(),
            target_language_id: column.string().optional(),
            created_at: column.number(),
            updated_at: column.number().indexed(),
          }),
        ],
      });
      database = await Database.open({
        driver: new NodeSqliteDriver(),
        schema: v4,
        name,
      });
      const legacy = database;
      await legacy.write(async () => {
        await legacy.get('user_decks').create({
          id: 'existing',
          title: 'Existing',
          description: null,
          note_type: 'basic',
          native_language_id: null,
          target_language_id: null,
          created_at: 1,
          updated_at: 1,
        });
      });
      await database.close();
      database = undefined;
      database = await Database.open({
        driver: new NodeSqliteDriver(),
        schema,
        migrations,
        name,
        modelClasses: [UserDeck],
      });
      const existing = await database.get(UserDeck).find('existing');
      expect(existing).toMatchObject({
        title: 'Existing',
        visibility: 'private',
        created_at: 1,
        updated_at: 1,
      });
      const created = await createDeck(database, 'New', null, {
        noteType: 'basic',
      });
      expect(created.visibility).toBe('private');
      await database.close();
      database = undefined;
      database = await Database.open({
        driver: new NodeSqliteDriver(),
        schema,
        migrations,
        name,
        modelClasses: [UserDeck],
      });
      expect((await database.get(UserDeck).find('existing')).visibility).toBe(
        'private',
      );
    } finally {
      await database?.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
