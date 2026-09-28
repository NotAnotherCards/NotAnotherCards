import { describe, expect, it } from 'vitest';
import { UserNoteRow } from './user-dictionary.js';

// The row schema checks registered note fields against @repo/study's
// registry and lets unknown types through.
describe('unknown note types are opaque to the client row schema', () => {
  it('passes an unregistered pair instead of failing the pull', () => {
    expect(
      UserNoteRow.safeParse({
        note_type: 'word',
        fields_version: 9,
        fields_json: '{"anything":"at all"}',
        additional_content: null,
        created_at: 1,
        updated_at: 1,
      }).success,
    ).toBe(true);
  });

  it('still rejects invalid fields of a registered pair', () => {
    expect(
      UserNoteRow.safeParse({
        note_type: 'word',
        fields_version: 1,
        fields_json: '{"word":"alone"}',
        additional_content: null,
        created_at: 1,
        updated_at: 1,
      }).success,
    ).toBe(false);
  });
});
