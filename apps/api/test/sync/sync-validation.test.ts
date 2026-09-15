import type {
  SyncEngineOptions,
  SyncStoreTx,
  WireRow,
} from '@remelondb/server';
import { describe, expect, it, vi } from 'vitest';
import {
  BASIC_FRONT_BACK_TEMPLATE_KEY,
  cardId,
  noteDeckId,
} from '@repo/offline-db';
import { LANGUAGES } from '@repo/schemas';
import { MAX_FUTURE_ACTIVITY_SKEW_MS } from '../../src/sync/sync-change-validation';
import { createCrossValidateSyncRelationships } from '../../src/sync/sync-validation';

const profileRow = (id: string): WireRow => ({
  id,
  username: null,
  bio: null,
  avatar_file_id: null,
  native_language_id: null,
  target_language_id: null,
  created_at: 1,
  updated_at: 1,
});

describe('sync relationship validation scan guards', () => {
  type CrossValidationChanges = Parameters<
    NonNullable<SyncEngineOptions<string>['crossValidateChanges']>
  >[2];
  const cases: Array<{ name: string; changes: CrossValidationChanges }> = [
    {
      name: 'profile-only',
      changes: {
        user_profiles: { rows: [profileRow('user-a')], deleted: [] },
      },
    },
  ];

  it.each(cases)(
    'does not scan relationship tables for a $name push',
    async ({ changes }) => {
      const changedSince = vi.fn();
      const tx = { changedSince } as unknown as SyncStoreTx<string>;
      const validate = createCrossValidateSyncRelationships(async () =>
        Promise.resolve(new Map()),
      );

      const rejected = await validate(tx, 'user-a', changes);

      expect(changedSince).not.toHaveBeenCalled();
      expect(Object.values(rejected).every((ids) => ids.length === 0)).toBe(
        true,
      );
    },
  );
});

describe('deck language validation', () => {
  const validate = createCrossValidateSyncRelationships(async () =>
    Promise.resolve(new Map()),
  );
  const tx = {
    changedSince: vi.fn(() => Promise.resolve([])),
  } as unknown as SyncStoreTx<string>;
  const [native, target] = LANGUAGES;
  const deck = (targetLanguageId: string): WireRow => ({
    id: 'deck-a',
    title: 'Words',
    description: null,
    visibility: 'private',
    note_type: 'word',
    native_language_id: native.value,
    target_language_id: targetLanguageId,
    created_at: 1,
    updated_at: 1,
  });

  it('rejects a word deck with the same language twice', async () => {
    const rejected = await validate(tx, 'user-a', {
      user_decks: { rows: [deck(native.value)], deleted: [] },
    });
    expect(rejected['user_decks']).toEqual(['deck-a']);
  });

  it('accepts a word deck with two known, different languages', async () => {
    const rejected = await validate(tx, 'user-a', {
      user_decks: { rows: [deck(target.value)], deleted: [] },
    });
    expect(rejected['user_decks']).toEqual([]);
  });
});

describe('note identity immutability (#194)', () => {
  const validate = createCrossValidateSyncRelationships(async () =>
    Promise.resolve(new Map()),
  );
  const storedBasic = {
    id: 'note-a',
    note_type: 'basic',
    fields_version: 1,
    fields_json: JSON.stringify({ front: 'f', back: 'b' }),
    additional_content: null,
    created_at: 1,
    updated_at: 1,
  };
  const tx = {
    changedSince: vi.fn(() =>
      Promise.resolve([{ id: 'note-a', rev: 1, row: storedBasic }]),
    ),
  } as unknown as SyncStoreTx<string>;

  it('rejects an update that changes a stored note type', async () => {
    const rejected = await validate(tx, 'user-a', {
      user_notes: {
        rows: [
          {
            ...storedBasic,
            note_type: 'word',
            fields_json: JSON.stringify({
              word: 'Hund',
              translation: 'dog',
              native_language_id: 'lang-en',
              target_language_id: 'lang-de',
            }),
          },
        ],
        deleted: [],
      },
    });
    expect(rejected['user_notes']).toEqual(['note-a']);
  });

  it('accepts an update that keeps the stored identity', async () => {
    const rejected = await validate(tx, 'user-a', {
      user_notes: {
        rows: [
          {
            ...storedBasic,
            fields_json: JSON.stringify({ front: 'f2', back: 'b2' }),
          },
        ],
        deleted: [],
      },
    });
    expect(rejected['user_notes'] ?? []).toHaveLength(0);
  });
});

describe('derived-card validation (#194)', () => {
  const validate = createCrossValidateSyncRelationships(async () =>
    Promise.resolve(new Map()),
  );
  const emptyTx = {
    changedSince: vi.fn(() => Promise.resolve([])),
  } as unknown as SyncStoreTx<string>;

  const wordNote = (id: string): WireRow => ({
    id,
    note_type: 'word',
    fields_version: 1,
    fields_json: JSON.stringify({
      word: 'Hund',
      translation: 'dog',
      native_language_id: 'lang-en',
      target_language_id: 'lang-de',
    }),
    additional_content: null,
    created_at: 1,
    updated_at: 1,
  });

  const cardFor = (
    noteId: string,
    templateKey: string,
    front: string,
    back: string,
    active = true,
  ): WireRow => ({
    id: cardId(noteId, templateKey),
    note_id: noteId,
    template_key: templateKey,
    active,
    front,
    back,
    due_at: 1,
    scheduled_interval_minutes: 0,
    created_at: 1,
    updated_at: 1,
  });

  const rejectedIds = async (
    tx: SyncStoreTx<string>,
    cards: WireRow[],
    notes: WireRow[] = [],
  ) => {
    const rejected = await validate(tx, 'user-a', {
      ...(notes.length > 0 && {
        user_notes: { rows: notes, deleted: [] },
      }),
      user_cards: { rows: cards, deleted: [] },
    });
    return rejected['user_cards'] ?? [];
  };

  it('accepts a same-push card that matches the compiled render', async () => {
    expect(
      await rejectedIds(
        emptyTx,
        [cardFor('note-a', 'word-to-translation', 'Hund', 'dog')],
        [wordNote('note-a')],
      ),
    ).toHaveLength(0);
  });

  it('rejects a same-push card whose content contradicts its note', async () => {
    expect(
      await rejectedIds(
        emptyTx,
        [cardFor('note-a', 'word-to-translation', 'x', 'y')],
        [wordNote('note-a')],
      ),
    ).toEqual([cardId('note-a', 'word-to-translation')]);
  });

  it('rejects a fabricated template key even with a matching id', async () => {
    expect(
      await rejectedIds(
        emptyTx,
        [cardFor('note-a', 'invented-template', 'x', 'y')],
        [wordNote('note-a')],
      ),
    ).toEqual([cardId('note-a', 'invented-template')]);
  });

  it('requires a card its fields cannot yield to arrive deactivated', async () => {
    const active = cardFor('note-a', 'example-to-translation', 's', 't');
    const inactive = cardFor(
      'note-a',
      'example-to-translation',
      's',
      't',
      false,
    );
    expect(
      await rejectedIds(emptyTx, [active], [wordNote('note-a')]),
    ).toHaveLength(1);
    expect(
      await rejectedIds(emptyTx, [inactive], [wordNote('note-a')]),
    ).toHaveLength(0);
  });

  describe('cards of stored notes', () => {
    const storedTx = {
      changedSince: vi.fn(() =>
        Promise.resolve([{ id: 'note-a', rev: 1, row: wordNote('note-a') }]),
      ),
    } as unknown as SyncStoreTx<string>;

    it('accepts stale content on a card-only push (the trust model)', async () => {
      expect(
        await rejectedIds(storedTx, [
          cardFor('note-a', 'word-to-translation', 'stale', 'stale'),
        ]),
      ).toHaveLength(0);
    });

    it('still rejects an invented template key against a stored note', async () => {
      expect(
        await rejectedIds(storedTx, [
          cardFor('note-a', 'invented-template', 'x', 'y'),
        ]),
      ).toEqual([cardId('note-a', 'invented-template')]);
    });
  });
});

describe('activity timestamp validation (#344)', () => {
  const serverNow = Date.parse('2040-02-01T00:02:00.000Z');
  const latestAllowed = serverNow + MAX_FUTURE_ACTIVITY_SKEW_MS;
  const basicNote = (id: string, createdAt: number): WireRow => ({
    id,
    note_type: 'basic',
    fields_version: 1,
    fields_json: JSON.stringify({ front: 'front', back: 'back' }),
    additional_content: null,
    created_at: createdAt,
    updated_at: createdAt,
  });
  const basicCard = (noteId: string): WireRow => ({
    id: cardId(noteId, BASIC_FRONT_BACK_TEMPLATE_KEY),
    note_id: noteId,
    template_key: BASIC_FRONT_BACK_TEMPLATE_KEY,
    active: true,
    front: 'front',
    back: 'back',
    due_at: serverNow,
    scheduled_interval_minutes: 0,
    created_at: serverNow,
    updated_at: serverNow,
  });
  const review = (id: string, userCardId: string, reviewedAt: number) => ({
    id,
    user_card_id: userCardId,
    rating: 3,
    reviewed_at: reviewedAt,
  });
  const stored = (row: WireRow) => ({ id: row.id, rev: 1, row });

  it('accepts the five-minute boundary and historical offline activity using one clock reading', async () => {
    const card = basicCard('durable-note');
    const now = vi.fn(() => serverNow);
    const validate = createCrossValidateSyncRelationships(
      async () => Promise.resolve(new Map()),
      now,
    );
    const tx = {
      changedSince: vi.fn((table: string) =>
        Promise.resolve(table === 'user_cards' ? [stored(card)] : []),
      ),
    } as unknown as SyncStoreTx<string>;

    const rejected = await validate(tx, 'user-a', {
      user_notes: {
        rows: [
          basicNote('boundary-note', latestAllowed),
          basicNote('offline-note', Date.parse('2020-01-01T00:00:00.000Z')),
        ],
        deleted: [],
      },
      review_events: {
        rows: [
          review('boundary-review', card.id, latestAllowed),
          review(
            'offline-review',
            card.id,
            Date.parse('2020-01-01T00:00:00.000Z'),
          ),
        ],
        deleted: [],
      },
    });

    expect(rejected['user_notes']).toEqual([]);
    expect(rejected['review_events']).toEqual([]);
    expect(now).toHaveBeenCalledOnce();
  });

  it('rejects new activity one millisecond beyond the allowance', async () => {
    const card = basicCard('durable-note');
    const validate = createCrossValidateSyncRelationships(
      async () => Promise.resolve(new Map()),
      () => serverNow,
    );
    const tx = {
      changedSince: vi.fn((table: string) =>
        Promise.resolve(table === 'user_cards' ? [stored(card)] : []),
      ),
    } as unknown as SyncStoreTx<string>;

    const rejected = await validate(tx, 'user-a', {
      user_notes: {
        rows: [basicNote('future-note', latestAllowed + 1)],
        deleted: [],
      },
      review_events: {
        rows: [review('future-review', card.id, latestAllowed + 1)],
        deleted: [],
      },
    });

    expect(rejected['user_notes']).toEqual(['future-note']);
    expect(rejected['review_events']).toEqual(['future-review']);
  });

  it('rejects every same-push row that depends on a future-dated note', async () => {
    const note = basicNote('future-note', latestAllowed + 1);
    const card = basicCard(note.id);
    const validate = createCrossValidateSyncRelationships(
      async () => Promise.resolve(new Map()),
      () => serverNow,
    );
    const durableDeck: WireRow = {
      id: 'durable-deck',
      title: 'Deck',
      description: null,
      visibility: 'private',
      note_type: 'basic',
      native_language_id: null,
      target_language_id: null,
      created_at: serverNow,
      updated_at: serverNow,
    };
    const membershipId = noteDeckId(note.id, durableDeck.id);
    const tx = {
      changedSince: vi.fn((table: string) =>
        Promise.resolve(table === 'user_decks' ? [stored(durableDeck)] : []),
      ),
    } as unknown as SyncStoreTx<string>;

    const rejected = await validate(tx, 'user-a', {
      user_notes: { rows: [note], deleted: [] },
      user_cards: { rows: [card], deleted: [] },
      user_note_decks: {
        rows: [
          {
            id: membershipId,
            note_id: note.id,
            deck_id: durableDeck.id,
            active: true,
            created_at: serverNow,
            updated_at: serverNow,
          },
        ],
        deleted: [],
      },
      review_events: {
        rows: [review('dependent-review', card.id, serverNow)],
        deleted: [],
      },
    });

    expect(rejected['user_notes']).toEqual([note.id]);
    expect(rejected['user_cards']).toEqual([card.id]);
    expect(rejected['user_note_decks']).toEqual([membershipId]);
    expect(rejected['review_events']).toEqual(['dependent-review']);
  });

  it('does not apply the new limit retroactively to durable note rows', async () => {
    const note = basicNote('durable-note', latestAllowed + 1);
    const validate = createCrossValidateSyncRelationships(
      async () => Promise.resolve(new Map()),
      () => serverNow,
    );
    const tx = {
      changedSince: vi.fn((table: string) => {
        const rows = table === 'user_notes' ? [stored(note)] : [];
        return Promise.resolve(rows);
      }),
    } as unknown as SyncStoreTx<string>;

    const rejected = await validate(tx, 'user-a', {
      user_notes: { rows: [note], deleted: [] },
    });

    expect(rejected['user_notes']).toEqual([]);
  });
});
