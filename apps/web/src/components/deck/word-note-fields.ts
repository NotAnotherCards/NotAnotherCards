import {
  WordNoteFieldsV1,
  type UserNoteRecord,
  type WordNoteFields,
} from '@repo/offline-db';

export function parseWordFields(
  note: Pick<UserNoteRecord, 'fields_json'>,
): WordNoteFields | null {
  try {
    const parsed = WordNoteFieldsV1.safeParse(JSON.parse(note.fields_json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
