import { compileNote } from '@repo/offline-db';
import { languageFor } from '@repo/schemas';
import type { PublishedContent } from './schema';

export interface ModerationNote {
  id: string;
  cardIds: string[];
  fields: Record<string, string>;
  languages: { native?: string; target?: string };
}

export const isShortText = (text: string) => Array.from(text).length <= 40;

/** Snapshot values only. Preserve each original string for the classifier. */
export function moderationNotes(snapshot: {
  nativeLanguageId: string | null;
  targetLanguageId: string | null;
  content: PublishedContent;
}): ModerationNote[] {
  const languages = {
    native: languageFor(snapshot.nativeLanguageId)?.name,
    target: languageFor(snapshot.targetLanguageId)?.name,
  };
  const cardsByNote = new Map<string, PublishedContent['cards']>();
  for (const card of snapshot.content.cards) {
    const cards = cardsByNote.get(card.note_id) ?? [];
    cards.push(card);
    cardsByNote.set(card.note_id, cards);
  }
  const notes = snapshot.content.notes.map((note) => {
    const cards = cardsByNote.get(note.id) ?? [];
    cardsByNote.delete(note.id);
    const fields: Record<string, string> = {};
    let differingCards = cards;
    try {
      const raw = JSON.parse(note.fields_json) as Record<string, unknown>;
      const compiled = compileNote(note.note_type, note.fields_version, raw);
      for (const [key, value] of Object.entries(raw)) {
        if (
          typeof value === 'string' &&
          ![
            'image',
            'word_audio',
            'native_language_id',
            'target_language_id',
          ].includes(key)
        )
          fields[key] = value;
      }
      differingCards = cards.filter(
        (card) =>
          !compiled.cards.some(
            (rendered) =>
              rendered.templateKey === card.template_key &&
              rendered.front === card.front &&
              rendered.back === card.back,
          ),
      );
    } catch {
      // Unknown/newer types and corrupt fields fall back to rendered text.
    }
    for (const [index, card] of differingCards.entries()) {
      fields[`card_${index}_front`] = card.front;
      fields[`card_${index}_back`] = card.back;
    }
    if (note.additional_content)
      fields.additional_content = note.additional_content;
    return {
      id: note.id,
      cardIds: cards.map((card) => card.id),
      fields,
      languages,
    };
  });
  for (const [id, cards] of cardsByNote) {
    const fields: Record<string, string> = {};
    cards.forEach((card, index) => {
      fields[`card_${index}_front`] = card.front;
      fields[`card_${index}_back`] = card.back;
    });
    notes.push({
      id,
      cardIds: cards.map((card) => card.id),
      fields,
      languages,
    });
  }
  return notes;
}

/** A shared text is classified once, but every containing note must clear it. */
export function moderationTexts(notes: ModerationNote[]) {
  const texts = new Map<
    string,
    { id: string; text: string; cardIds: Set<string>; contexts: Set<string> }
  >();
  for (const note of notes) {
    for (const text of Object.values(note.fields)) {
      if (!text.trim()) continue;
      const item = texts.get(text) ?? {
        id: `text-${texts.size}`,
        text,
        cardIds: new Set<string>(),
        contexts: new Set<string>(),
      };
      note.cardIds.forEach((id) => item.cardIds.add(id));
      item.contexts.add(
        JSON.stringify({
          fields: Object.fromEntries(
            Object.entries(note.fields).filter(
              ([, value]) => value !== text && isShortText(value),
            ),
          ),
          languages: note.languages,
        }),
      );
      texts.set(text, item);
    }
  }
  return [...texts.values()].map((item) => ({
    ...item,
    cardIds: [...item.cardIds],
    contexts: [...item.contexts],
  }));
}
