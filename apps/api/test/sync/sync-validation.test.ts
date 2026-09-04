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

describe('template-key membership for same-push cards (#194)', () => {
  const validate = createCrossValidateSyncRelationships(async () =>
    Promise.resolve(new Map()),
  );
  const tx = {
    changedSince: vi.fn(async () => []),
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

  const cardFor = (noteId: string, templateKey: string): WireRow => ({
    id: cardId(noteId, templateKey),
    note_id: noteId,
    template_key: templateKey,
    active: true,
    front: 'x',
    back: 'y',
    due_at: 1,
    scheduled_interval_minutes: 0,
    created_at: 1,
    updated_at: 1,
  });

  it('accepts a card whose key belongs to the note type', async () => {
    const rejected = await validate(tx, 'user-a', {
      user_notes: { rows: [wordNote('note-a')], deleted: [] },
      user_cards: {
        rows: [cardFor('note-a', 'word-to-translation')],
        deleted: [],
      },
    });
    expect(Object.values(rejected).flat()).toHaveLength(0);
  });

  it('rejects a fabricated template key even with a matching id', async () => {
    const rejected = await validate(tx, 'user-a', {
      user_notes: { rows: [wordNote('note-a')], deleted: [] },
      user_cards: {
        rows: [cardFor('note-a', 'invented-template')],
        deleted: [],
      },
    });
    expect(rejected['user_cards']).toEqual([
      cardId('note-a', 'invented-template'),
    ]);
    expect(rejected['user_notes'] ?? []).toHaveLength(0);
  });
});
