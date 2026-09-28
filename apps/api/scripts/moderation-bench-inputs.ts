// Produce exactly the server's contextual inputs for the Python GX10 harness.
// tsx scripts/moderation-bench-inputs.ts corpus <corpus.jsonl>
// tsx scripts/moderation-bench-inputs.ts deck <backup.json>
import { readFileSync } from 'node:fs';
import { BASIC_FRONT_BACK_TEMPLATE_KEY, compileNote } from '@repo/offline-db';
import { moderationNotes } from '../src/sharing/moderation-context';
import type { PublishedContent } from '../src/sharing/schema';

const [mode, path] = process.argv.slice(2);
const emit = (id: string, label: string, text: string) =>
  process.stdout.write(`${JSON.stringify({ id, label, text })}\n`);

if (mode === 'corpus') {
  for (const line of readFileSync(path, 'utf8').split('\n').filter(Boolean)) {
    const item = JSON.parse(line) as {
      id: string;
      label: string;
      text: string;
    };
    const [note] = moderationNotes({
      nativeLanguageId: null,
      targetLanguageId: null,
      content: {
        notes: [
          {
            id: item.id,
            note_type: 'basic',
            fields_version: 1,
            fields_json: JSON.stringify({ front: item.text, back: '' }),
            additional_content: null,
          },
        ],
        cards: [
          {
            id: item.id,
            note_id: item.id,
            template_key: BASIC_FRONT_BACK_TEMPLATE_KEY,
            front: item.text,
            back: '',
          },
        ],
      },
    });
    emit(item.id, item.label, note.text);
  }
} else if (mode === 'deck') {
  const backup = JSON.parse(readFileSync(path, 'utf8')) as {
    decks: { native_language: string; target_language: string }[];
    notes: {
      note_type: string;
      fields_version: number;
      fields: unknown;
      additional_content: string | null;
    }[];
  };
  const content: PublishedContent = { notes: [], cards: [] };
  backup.notes.forEach((note, index) => {
    const id = `note-${index}`;
    const compiled = compileNote(
      note.note_type,
      note.fields_version,
      note.fields,
    );
    content.notes.push({
      id,
      note_type: note.note_type,
      fields_version: note.fields_version,
      fields_json: compiled.fieldsJson,
      additional_content: note.additional_content,
    });
    content.cards.push(
      ...compiled.cards.map((card) => ({
        id: `${id}:${card.templateKey}`,
        note_id: id,
        template_key: card.templateKey,
        front: card.front,
        back: card.back,
      })),
    );
  });
  moderationNotes({
    content,
    nativeLanguageId: backup.decks[0].native_language,
    targetLanguageId: backup.decks[0].target_language,
  }).forEach((note, index) => emit(`note-${index}`, 'safe', note.text));
} else {
  throw new Error('usage: moderation-bench-inputs.ts corpus|deck <path>');
}
