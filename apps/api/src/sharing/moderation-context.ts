import { compileNote } from '@repo/offline-db';
import { languageFor } from '@repo/schemas';
import type { PublishedContent } from './schema';

export interface ModerationNote {
  cardIds: string[];
  text: string;
}

/** Use the immutable publish snapshot, never client-supplied prompt context. */
export function moderationNotes(snapshot: {
  nativeLanguageId: string | null;
  targetLanguageId: string | null;
  content: PublishedContent;
}): ModerationNote[] {
  const native = languageFor(snapshot.nativeLanguageId)?.name;
  const target = languageFor(snapshot.targetLanguageId)?.name;
  const cardsByNote = new Map<string, PublishedContent['cards']>();
  for (const card of snapshot.content.cards) {
    const cards = cardsByNote.get(card.note_id) ?? [];
    cards.push(card);
    cardsByNote.set(card.note_id, cards);
  }
  return snapshot.content.notes.map((note) => {
    const cards = cardsByNote.get(note.id) ?? [];
    const compiled = compileNote(
      note.note_type,
      note.fields_version,
      JSON.parse(note.fields_json),
    );
    const fields = JSON.parse(compiled.fieldsJson) as Record<string, unknown>;
    delete fields.image;
    delete fields.word_audio;
    delete fields.native_language_id;
    delete fields.target_language_id;
    // Legacy cards can differ from the current templates. Check that visible
    // text too: trusting fields alone would leave a publish bypass.
    const differingCards = cards
      .filter(
        (card) =>
          !compiled.cards.some(
            (rendered) =>
              rendered.templateKey === card.template_key &&
              rendered.front === card.front &&
              rendered.back === card.back,
          ),
      )
      .map(({ front, back }) => ({ front, back }));
    // Do not label arbitrary basic-card prose as educational. That framing
    // reduced harmful-corpus recall even before the judge ran. Word fields
    // supply actual vocabulary context, including examples and languages.
    const text =
      note.note_type === 'basic'
        ? [fields.front, fields.back].filter(Boolean).join('\n')
        : Object.entries(fields)
            .map(([key, value]) => `${key}: ${String(value)}`)
            .join('\n');
    const context =
      note.note_type === 'word' && native && target
        ? `Vocabulary note from a ${target} course for ${native} speakers.`
        : '';
    return {
      cardIds: cards.map((card) => card.id),
      text: [
        text,
        note.additional_content,
        ...differingCards.map(({ front, back }) => `${front}\n${back}`),
        context,
      ]
        .filter(Boolean)
        .join('\n'),
    };
  });
}
