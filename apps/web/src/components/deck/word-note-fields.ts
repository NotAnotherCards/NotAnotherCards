import {
  WordNoteFieldsV1,
  type UserNoteRecord,
  type WordNoteFields,
} from '@repo/offline-db';

export type RecoverableWordFields = Partial<
  Pick<
    WordNoteFields,
    | 'word'
    | 'translation'
    | 'example'
    | 'example_translation'
    | 'part_of_speech'
    | 'gender'
    | 'pronunciation'
    | 'notes'
  >
>;

export type WordFieldsParseResult =
  | { readonly kind: 'valid'; readonly fields: WordNoteFields }
  | {
      readonly kind: 'recoverable';
      readonly initialData: RecoverableWordFields;
    }
  | { readonly kind: 'unreadable' };

export interface PreservedWordMedia {
  readonly image?: string;
  readonly word_audio?: string;
}

const recoverableKeys = [
  'word',
  'translation',
  'example',
  'example_translation',
  'part_of_speech',
  'gender',
  'pronunciation',
  'notes',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function inspectWordFields(
  note: Pick<UserNoteRecord, 'fields_json'>,
): WordFieldsParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(note.fields_json);
  } catch {
    return { kind: 'unreadable' };
  }

  const result = WordNoteFieldsV1.safeParse(parsed);
  if (result.success) return { kind: 'valid', fields: result.data };

  const initialData: RecoverableWordFields = {};
  if (isRecord(parsed)) {
    const fields = parsed;
    for (const key of recoverableKeys) {
      if (typeof fields[key] === 'string') initialData[key] = fields[key];
    }
  }
  return { kind: 'recoverable', initialData };
}

export function parseWordFields(
  note: Pick<UserNoteRecord, 'fields_json'>,
): WordNoteFields | null {
  const result = inspectWordFields(note);
  return result.kind === 'valid' ? result.fields : null;
}

/** Media cannot be edited or displayed yet, but an unrelated word edit must
 * not erase its stored note_media ids. */
export function preservedWordMedia(
  note: Pick<UserNoteRecord, 'fields_json'>,
): PreservedWordMedia {
  try {
    const parsed: unknown = JSON.parse(note.fields_json);
    if (!isRecord(parsed)) return {};
    return {
      ...(typeof parsed.image === 'string' ? { image: parsed.image } : {}),
      ...(typeof parsed.word_audio === 'string'
        ? { word_audio: parsed.word_audio }
        : {}),
    };
  } catch {
    return {};
  }
}
