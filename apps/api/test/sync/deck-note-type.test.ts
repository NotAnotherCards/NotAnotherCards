import {
  BASIC_NOTE_TYPE,
  noteDeckId,
  WORD_NOTE_FIELDS_VERSION,
  WORD_NOTE_TYPE,
} from '@repo/offline-db';
import { LANGUAGES } from '@repo/schemas';
import { accepted, pulled } from '@remelondb/server/conformance';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createAppSyncEngine,
  createAppSyncStore,
} from '../../src/sync/sync-store';
import {
  db,
  hasPostgres,
  resetPostgres,
  setUpPostgres,
  tearDownPostgres,
} from './postgres-fixture';

const describePostgres = hasPostgres ? describe : describe.skip;
const pullArgs = (cursor: string | null) => ({
  cursor,
  schemaVersion: 1,
  migration: null,
});

describePostgres("a deck's note type", () => {
  beforeAll(setUpPostgres, 30_000);
  beforeEach(resetPostgres);
  afterAll(tearDownPostgres, 30_000);

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

    const changed = accepted(
      await handlers.push({
        cursor: created.cursor!,
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
    const membershipId = noteDeckId(noteId, deckId);
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
                id: membershipId,
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
    expect(result.rejected?.user_decks ?? []).toEqual([]);
    expect(result.rejected?.user_notes ?? []).toEqual([]);
    expect(result.rejected?.user_note_decks).toEqual([membershipId]);
  });
});
