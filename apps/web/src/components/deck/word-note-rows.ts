import type { Card } from '@/hooks/useStore';
import {
  EXAMPLE_TO_TRANSLATION_TEMPLATE_KEY,
  TRANSLATION_TO_WORD_TEMPLATE_KEY,
  WORD_TO_TRANSLATION_TEMPLATE_KEY,
  type WordNoteFields,
  type UserNoteRecord,
} from '@repo/offline-db';
import { languageFor } from '@repo/schemas';
import {
  inspectWordFields,
  parseWordFields,
  type RecoverableWordFields,
} from './word-note-fields';

type WordCardBadge = 'Word' | 'Translation' | 'Example';

export interface WordRow {
  readonly note: UserNoteRecord;
  readonly fields: WordNoteFields;
  readonly word: string;
  readonly translation: string;
  readonly cards: readonly Card[];
  readonly detailsCount: number;
  readonly badges: string[];
}

export interface InvalidWordRow {
  readonly note: UserNoteRecord;
  readonly cards: readonly Card[];
  readonly problem: 'recoverable' | 'unreadable';
  readonly initialData?: RecoverableWordFields;
}

export type WordListRow = WordRow | InvalidWordRow;

const badgeForTemplateKey: Readonly<Record<string, WordCardBadge>> = {
  [WORD_TO_TRANSLATION_TEMPLATE_KEY]: 'Word',
  [TRANSLATION_TO_WORD_TEMPLATE_KEY]: 'Translation',
  [EXAMPLE_TO_TRANSLATION_TEMPLATE_KEY]: 'Example',
};
const badgeOrder: readonly WordCardBadge[] = ['Word', 'Translation', 'Example'];
function languageCode(languageId: string): string {
  const language = languageFor(languageId);
  return language?.code ?? '??';
}

function badgeLabel(
  badge: WordCardBadge,
  nativeLanguageId: string,
  targetLanguageId: string,
): string {
  const native = languageCode(nativeLanguageId);
  const target = languageCode(targetLanguageId);
  if (badge === 'Word') return `${target} → ${native}`;
  if (badge === 'Translation') return `${native} → ${target}`;
  return `Example → ${native}`;
}

export function countWordDetails(
  fields: Record<string, string | undefined>,
): number {
  const hasExample =
    fields.example !== undefined || fields.example_translation !== undefined;
  const keys = ['part_of_speech', 'gender', 'pronunciation', 'notes'] as const;
  return (
    Number(hasExample) + keys.filter((key) => fields[key] !== undefined).length
  );
}

export function toWordRow(
  note: UserNoteRecord,
  noteCards: readonly Card[],
): WordRow | null {
  const fields = parseWordFields(note);
  if (!fields) return null;
  return rowFromFields(note, noteCards, fields);
}

function rowFromFields(
  note: UserNoteRecord,
  noteCards: readonly Card[],
  fields: WordNoteFields,
): WordRow {
  const existing = new Set(
    noteCards.flatMap((card) => {
      const badge = badgeForTemplateKey[card.template_key];
      return badge ? [badge] : [];
    }),
  );
  const badges = badgeOrder
    .filter((badge) => existing.has(badge))
    .map((badge) =>
      badgeLabel(badge, fields.native_language_id, fields.target_language_id),
    );
  return {
    note,
    fields,
    word: fields.word,
    translation: fields.translation,
    cards: noteCards,
    badges,
    detailsCount: countWordDetails(fields),
  };
}

export function toWordListRow(
  note: UserNoteRecord,
  noteCards: readonly Card[],
): WordListRow {
  const result = inspectWordFields(note);
  if (result.kind === 'valid') {
    return rowFromFields(note, noteCards, result.fields);
  }
  if (result.kind === 'recoverable') {
    return {
      note,
      cards: noteCards,
      problem: 'recoverable',
      initialData: result.initialData,
    };
  }
  return { note, cards: noteCards, problem: 'unreadable' };
}
