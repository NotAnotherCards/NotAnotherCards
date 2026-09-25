import { useState } from 'react';
import {
  parseWordFields,
  WORD_NOTE_TYPE,
  type UserDeckRecord,
  type UserNoteRecord,
} from '@repo/offline-db';
import type { Card as CardRecord } from '@/lib/cards';
import type { cardWrites } from '@/lib/card-writes';
import { writeErrorMessage } from '@/lib/errors';
import { CardForm } from './card-form';
import { WordNoteForm, type WordFormValues } from './word-note-form';
import { Text } from './ui/text';

// The deck's note type picks the form: a word deck edits words, any other
// deck front/back cards. Without a card it creates one in the deck. The
// card list and the review both open it; onDone runs after a save or a
// cancel, and the caller decides what shows next.
export function CardEditor({
  deck,
  card,
  note,
  writes,
  onDone,
}: {
  deck: UserDeckRecord;
  card?: CardRecord;
  note?: UserNoteRecord | null;
  writes: ReturnType<typeof cardWrites>;
  onDone: () => void;
}) {
  const [writeError, setWriteError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const run = async (write: () => Promise<unknown>) => {
    setWriteError(null);
    setPending(true);
    try {
      await write();
      onDone();
    } catch (err) {
      setWriteError(writeErrorMessage(err, 'The write failed'));
      setPending(false);
    }
  };
  // A write in flight decides what shows next, so cancel waits for it.
  const cancel = () => {
    if (!pending) onDone();
  };

  if (!card) {
    const nativeLanguageId = deck.native_language_id;
    const targetLanguageId = deck.target_language_id;
    if (deck.note_type === WORD_NOTE_TYPE) {
      if (!(nativeLanguageId && targetLanguageId)) {
        return (
          <Text className="text-destructive">
            This word deck does not have a valid language pair.
          </Text>
        );
      }
      return (
        <WordNoteForm
          title="New word"
          targetLanguageId={targetLanguageId}
          error={writeError}
          onSubmit={(values) =>
            run(() =>
              writes.createWord(deck.id, {
                ...values,
                native_language_id: nativeLanguageId,
                target_language_id: targetLanguageId,
              }),
            )
          }
          onCancel={cancel}
        />
      );
    }
    return (
      <CardForm
        title="New card"
        error={writeError}
        onSubmit={(values) =>
          run(() => writes.create(deck.id, values.front, values.back))
        }
        onCancel={cancel}
      />
    );
  }

  if (note?.note_type === WORD_NOTE_TYPE) {
    // Invalid synced payloads remain visible but cannot be edited.
    const fields = parseWordFields(note);
    if (!fields) return null;
    const updateWord = (values: WordFormValues) =>
      run(() =>
        writes.updateWord(note.id, {
          ...values,
          native_language_id: fields.native_language_id,
          target_language_id: fields.target_language_id,
          ...(fields.image ? { image: fields.image } : {}),
          ...(fields.word_audio ? { word_audio: fields.word_audio } : {}),
        }),
      );
    return (
      <WordNoteForm
        title="Edit word"
        initialValues={fields}
        targetLanguageId={fields.target_language_id}
        error={writeError}
        onSubmit={updateWord}
        onCancel={cancel}
      />
    );
  }
  return (
    <CardForm
      title="Edit card"
      initialValues={{ front: card.front, back: card.back }}
      error={writeError}
      onSubmit={(values) =>
        run(() => writes.update(card.id, values.front, values.back))
      }
      onCancel={cancel}
    />
  );
}
