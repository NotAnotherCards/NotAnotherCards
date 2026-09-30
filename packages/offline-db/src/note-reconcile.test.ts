import { afterEach, describe, expect, it, vi } from 'vitest';
import { Database, type SyncControllerState } from '@remelondb/core';
import { NodeSqliteDriver } from '@remelondb/driver-node';
import { cardId } from './ids.js';
import {
  normalizeLegacyCardContent,
  normalizeLegacyCardContentAfterSync,
  prepareReconcileNoteCards,
} from './note-reconcile.js';
import { compileNote, type WordNoteFields } from '@repo/study';
import { schema } from './index.js';
import { UserCard, UserNote } from './user-dictionary.js';

const word: WordNoteFields = {
  word: 'laufen',
  translation: 'to run',
  native_language_id: 'lang-en',
  target_language_id: 'lang-de',
};

const withExample: WordNoteFields = {
  ...word,
  example: 'Ich laufe jeden Morgen.',
  example_translation: 'I run every morning.',
};

let db: Database;
afterEach(async () => {
  await db.close();
});

const openDb = async () => {
  db = await Database.open({
    driver: new NodeSqliteDriver(),
    schema,
    modelClasses: [UserNote, UserCard],
    name: ':memory:',
  });
  return db;
};

const createWordNote = async (fields: WordNoteFields, noteId = 'note-1') => {
  const compiled = compileNote('word', 1, fields);
  await db.write(async () => {
    const now = Date.now();
    const noteOp = db.get(UserNote).prepareCreate({
      id: noteId,
      note_type: 'word',
      fields_version: 1,
      fields_json: compiled.fieldsJson,
      additional_content: null,
      created_at: now,
      updated_at: now,
    });
    const cardOps = await prepareReconcileNoteCards(db, noteId, compiled);
    await db.batch([noteOp, ...cardOps]);
  });
  return noteId;
};

const reconcile = async (noteId: string, fields: WordNoteFields) => {
  const compiled = compileNote('word', 1, fields);
  return await db.write(async () => {
    const ops = await prepareReconcileNoteCards(db, noteId, compiled);
    await db.batch(ops);
    return ops.length;
  });
};

const cardsOf = async (noteId: string) =>
  await db
    .get(UserCard)
    .query()
    .fetch()
    .then((cards) => cards.filter((c) => c.note_id === noteId));

describe('prepareReconcileNoteCards', () => {
  it('creates both direction cards for a minimal word note, due now', async () => {
    await openDb();
    await createWordNote(word);
    const cards = await cardsOf('note-1');
    expect(cards.map((c) => c.template_key).sort()).toEqual([
      'translation-to-word',
      'word-to-translation',
    ]);
    for (const card of cards) {
      expect(card.id).toBe(cardId('note-1', card.template_key));
      expect(card.active).toBe(false);
      expect(card.front.length).toBeGreaterThan(0);
    }
  });

  it('is idempotent: a second reconcile with the same fields prepares nothing', async () => {
    await openDb();
    await createWordNote(word);
    expect(await reconcile('note-1', word)).toBe(0);
  });

  it('creates the example card when both example fields arrive', async () => {
    await openDb();
    await createWordNote(word);
    await reconcile('note-1', withExample);
    const cards = await cardsOf('note-1');
    expect(cards).toHaveLength(3);
    const example = cards.find(
      (c) => c.template_key === 'example-to-translation',
    )!;
    expect(example.front).toBe('Ich laufe jeden Morgen.');
    // the word card's back gained the example line, updated in place
    const wtt = cards.find((c) => c.template_key === 'word-to-translation')!;
    expect(wtt.back).toBe('to run\n\nIch laufe jeden Morgen.');
  });

  it('clears the example card when the example goes, without changing activation', async () => {
    await openDb();
    await createWordNote(withExample);
    await reconcile('note-1', word);
    const cards = await cardsOf('note-1');
    expect(cards).toHaveLength(3);
    const example = cards.find(
      (c) => c.template_key === 'example-to-translation',
    )!;
    expect(example.active).toBe(false);
    expect(example.front).toBe('');
    expect(example.back).toBe('');
  });

  it('restores an incomplete card as due now without changing activation', async () => {
    await openDb();
    await createWordNote(withExample);
    // the card earns a schedule, then its field disappears, then returns
    const exampleId = cardId('note-1', 'example-to-translation');
    await db.write(async () => {
      const card = await db.get(UserCard).find(exampleId);
      await card.update((record) => {
        record.scheduled_interval_minutes = 1440;
        record.due_at = Date.now() + 86_400_000;
      });
    });
    await reconcile('note-1', word);
    const before = Date.now();
    await reconcile('note-1', withExample);
    const card = await db.get(UserCard).find(exampleId);
    expect(card.active).toBe(false);
    expect(card.due_at).toBeLessThanOrEqual(Date.now());
    expect(card.due_at).toBeGreaterThanOrEqual(before);
    expect(card.scheduled_interval_minutes).toBe(1440);
  });

  it('leaves a card with an unknown template key strictly alone', async () => {
    await openDb();
    await createWordNote(word);
    const futureId = cardId('note-1', 'from-a-newer-client');
    await db.write(async () => {
      const now = Date.now();
      await db.batch([
        db.get(UserCard).prepareCreate({
          id: futureId,
          note_id: 'note-1',
          template_key: 'from-a-newer-client',
          active: true,
          front: 'f',
          back: 'b',
          due_at: now,
          scheduled_interval_minutes: 0,
          created_at: now,
          updated_at: now,
        }),
      ]);
    });
    expect(await reconcile('note-1', word)).toBe(0);
    const future = await db.get(UserCard).find(futureId);
    expect(future.active).toBe(true);
    expect(future.front).toBe('f');
  });

  it('compileNote throws for an unregistered type instead of guessing', () => {
    expect(() => compileNote('phrase', 1, {})).toThrow(
      /Unsupported note type phrase@1/,
    );
  });
});

describe('normalizeLegacyCardContent', () => {
  it('clears old stale content and activates it when a sibling is active', async () => {
    await openDb();
    await createWordNote(withExample);
    await db.write(async () => {
      const note = await db.get(UserNote).find('note-1');
      await note.update((record) => {
        record.fields_json = compileNote('word', 1, word).fieldsJson;
      });
    });
    const exampleId = cardId('note-1', 'example-to-translation');
    const wordCardId = cardId('note-1', 'word-to-translation');
    await db.write(async () => {
      const [example, wordCard] = await Promise.all([
        db.get(UserCard).find(exampleId),
        db.get(UserCard).find(wordCardId),
      ]);
      await wordCard.update((record) => {
        record.active = true;
      });
      await example.update((record) => {
        record.active = false;
      });
    });
    await reconcile('note-1', word);
    await db.write(async () => {
      const example = await db.get(UserCard).find(exampleId);
      await example.update((record) => {
        record.front = 'old example';
        record.back = 'old translation';
      });
    });

    expect(await normalizeLegacyCardContent(db)).toBe(1);
    const example = await db.get(UserCard).find(exampleId);
    expect(example).toMatchObject({ active: true, front: '', back: '' });
    expect(await normalizeLegacyCardContent(db)).toBe(0);
  });

  it('leaves an old stale card inactive when no sibling is active', async () => {
    await openDb();
    await createWordNote(withExample);
    await db.write(async () => {
      const note = await db.get(UserNote).find('note-1');
      await note.update((record) => {
        record.fields_json = compileNote('word', 1, word).fieldsJson;
      });
    });
    const exampleId = cardId('note-1', 'example-to-translation');
    await reconcile('note-1', word);
    await db.write(async () => {
      const example = await db.get(UserCard).find(exampleId);
      await example.update((record) => {
        record.front = 'old example';
        record.back = 'old translation';
      });
    });

    expect(await normalizeLegacyCardContent(db)).toBe(1);
    const example = await db.get(UserCard).find(exampleId);
    expect(example).toMatchObject({ active: false, front: '', back: '' });
  });

  it('runs once after a completed sync', async () => {
    await openDb();
    await createWordNote(withExample);
    await db.write(async () => {
      const note = await db.get(UserNote).find('note-1');
      await note.update((record) => {
        record.fields_json = compileNote('word', 1, word).fieldsJson;
      });
    });
    const exampleId = cardId('note-1', 'example-to-translation');
    await reconcile('note-1', word);
    await db.write(async () => {
      const example = await db.get(UserCard).find(exampleId);
      await example.update((record) => {
        record.front = 'old example';
        record.back = 'old translation';
      });
    });
    let listener: (state: SyncControllerState) => void;
    let complete = false;
    const markComplete = vi.fn(() => {
      complete = true;
    });
    const syncController = {
      notifyLocalWrite: vi.fn(),
      subscribe(callback: (state: SyncControllerState) => void) {
        listener = callback;
        return () => undefined;
      },
    };
    const stop = normalizeLegacyCardContentAfterSync(db, syncController, {
      isComplete: () => complete,
      markComplete,
    });
    const completedSync: SyncControllerState = {
      status: 'idle',
      lastSyncAt: Date.now(),
      error: null,
      lastResult: null,
    };

    listener(completedSync);
    await vi.waitFor(() => expect(markComplete).toHaveBeenCalledTimes(1));
    expect(await db.get(UserCard).find(exampleId)).toMatchObject({
      front: '',
      back: '',
    });
    expect(syncController.notifyLocalWrite).toHaveBeenCalledTimes(1);
    await db.write(async () => {
      const example = await db.get(UserCard).find(exampleId);
      await example.update((record) => {
        record.front = 'old example again';
        record.back = 'old translation again';
      });
    });
    listener(completedSync);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(markComplete).toHaveBeenCalledTimes(1);
    expect(syncController.notifyLocalWrite).toHaveBeenCalledTimes(1);
    expect(await db.get(UserCard).find(exampleId)).toMatchObject({
      front: 'old example again',
      back: 'old translation again',
    });
    stop();
  });
});

describe('compileNote validation', () => {
  it('throws on fields of the wrong shape instead of rendering nonsense', () => {
    expect(() => compileNote('word', 1, { front: 'a', back: 'b' })).toThrow();
  });

  it('canonicalizes: padded input compiles to trimmed cards and json', () => {
    const compiled = compileNote('word', 1, {
      ...word,
      word: '  laufen  ',
      translation: ' to run ',
    });
    expect(compiled.cards[0]!.front).toBe('laufen');
    expect(JSON.parse(compiled.fieldsJson)).toMatchObject({ word: 'laufen' });
  });
});
