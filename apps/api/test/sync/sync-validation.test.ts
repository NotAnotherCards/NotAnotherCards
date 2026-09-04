import type {
  SyncEngineOptions,
  SyncStoreTx,
  WireRow,
} from '@remelondb/server';
import { describe, expect, it, vi } from 'vitest';
import { cardId } from '@repo/offline-db';
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

const validNoteRow = (id: string): WireRow => ({
  id,
  note_type: 'basic',
  fields_version: 1,
  fields_json: JSON.stringify({ front: 'front', back: 'back' }),
  additional_content: null,
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
    {
      name: 'note-only',
      changes: {
        user_notes: { rows: [validNoteRow('note-a')], deleted: [] },
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
