import type { Card } from '@/hooks/useStore';
import {
  EXAMPLE_TO_TRANSLATION_TEMPLATE_KEY,
  TRANSLATION_TO_WORD_TEMPLATE_KEY,
  WORD_TO_TRANSLATION_TEMPLATE_KEY,
  WordNoteFieldsV1,
  type UserNoteRecord,
} from '@repo/offline-db';
import { languageFor } from '@repo/schemas';

type WordCardBadge = 'Word' | 'Translation' | 'Example' | 'Audio';

export interface WordRow {
  readonly note: UserNoteRecord;
  readonly word: string;
  readonly translation: string;
  readonly cards: Card[];
  readonly detailsCount: number;
  readonly badges: string[];
  readonly actionCard: Card | null;
}

const badgeForTemplateKey: Readonly<Record<string, WordCardBadge>> = {
  [WORD_TO_TRANSLATION_TEMPLATE_KEY]: 'Word',
  [TRANSLATION_TO_WORD_TEMPLATE_KEY]: 'Translation',
  [EXAMPLE_TO_TRANSLATION_TEMPLATE_KEY]: 'Example',
  audio: 'Audio',
  listen: 'Audio',
};
const badgeOrder: readonly WordCardBadge[] = [
  'Word',
  'Translation',
  'Example',
  'Audio',
];
const languageCodeForName: Readonly<Record<string, string>> = {
  English: 'EN',
  Spanish: 'ES',
  German: 'DE',
  Russian: 'RU',
};

function languageCode(languageId: string): string {
  const language = languageFor(languageId);
  return language ? (languageCodeForName[language.name] ?? '??') : '??';
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
  if (badge === 'Example') return `Example → ${target}`;
  return 'Audio';
}

export function countWordDetails(
  fields: Record<string, string | undefined>,
): number {
  const hasExample =
    fields.example !== undefined || fields.example_translation !== undefined;
  const keys = [
    'part_of_speech',
    'gender',
    'pronunciation',
    'notes',
    'image',
    'word_audio',
  ] as const;
  return (
    Number(hasExample) + keys.filter((key) => fields[key] !== undefined).length
  );
}

export function toWordRow(note: UserNoteRecord, cards: Card[]): WordRow | null {
  try {
    const parsed = WordNoteFieldsV1.safeParse(JSON.parse(note.fields_json));
    if (!parsed.success) return null;
    const fields = parsed.data;
    const noteCards = cards.filter((card) => card.note_id === note.id);
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
      word: fields.word,
      translation: fields.translation,
      cards: noteCards,
      badges,
      detailsCount: countWordDetails(fields),
      actionCard:
        noteCards.find(
          (card) => card.template_key === WORD_TO_TRANSLATION_TEMPLATE_KEY,
        ) ??
        noteCards[0] ??
        null,
    };
  } catch {
    return null;
  }
}
