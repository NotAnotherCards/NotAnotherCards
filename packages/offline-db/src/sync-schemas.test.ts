import { describe, expect, it } from 'vitest';
import { syncWireSchemas } from './sync-schemas.js';

const noteRow = (overrides: Record<string, unknown>) => ({
  id: 'note-1',
  note_type: 'basic',
  fields_version: 1,
  fields_json: JSON.stringify({ front: 'f', back: 'b' }),
  additional_content: null,
  created_at: 1,
  updated_at: 1,
  ...overrides,
});

const pullWith = (note: Record<string, unknown>) => ({
  cursor: '1',
  changes: {
    user_notes: {
      created: [note],
      updated: [],
      deleted: [],
    },
  },
});

describe('the pull wire boundary and unknown note types', () => {
  it('accepts a pull carrying an unregistered (type, version) pair', () => {
    const result = syncWireSchemas.pullResult.safeParse(
      pullWith(
        noteRow({
          note_type: 'word',
          fields_version: 9,
          fields_json: '{"future":"shape"}',
        }),
      ),
    );
    expect(result.success).toBe(true);
  });

  it('still rejects a registered pair with invalid fields', () => {
    const result = syncWireSchemas.pullResult.safeParse(
      pullWith(noteRow({ fields_json: '{"front":"only"}' })),
    );
    expect(result.success).toBe(false);
  });
});
