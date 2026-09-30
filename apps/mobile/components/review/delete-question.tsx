import { useState } from 'react';
import { View } from 'react-native';
import {
  parseWordFields,
  WORD_NOTE_TYPE,
  type UserNoteRecord,
} from '@repo/offline-db';
import type { Card as CardRecord } from '@/lib/cards';
import type { cardWrites } from '@/lib/card-writes';
import { writeErrorMessage } from '@/lib/errors';
import { Button } from '../ui/button';
import { Text } from '../ui/text';

// The question a swipe down asks, in place of the card: the word or the
// front, No, Delete. No keyboard, no form; the pencil and the long press
// still open the full editor. Delete takes the whole note, its cards and
// their review history everywhere, then onDeleted runs.
export function DeleteQuestion({
  card,
  note,
  writes,
  onCancel,
  onDeleted,
}: {
  card: CardRecord;
  note: UserNoteRecord | null;
  writes: ReturnType<typeof cardWrites>;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isWord = note?.note_type === WORD_NOTE_TYPE;
  const name = (isWord && parseWordFields(note)?.word) || card.front;
  const shown = name.length > 24 ? `${name.slice(0, 24)}…` : name;

  const remove = async () => {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      await writes.deleteNote(card.note_id);
      onDeleted();
    } catch (err) {
      setError(writeErrorMessage(err, 'The delete failed'));
      setPending(false);
    }
  };

  return (
    <View className="items-center gap-4 py-12">
      <Text className="text-center text-lg font-semibold">
        Delete &quot;{shown}&quot;?
      </Text>
      <Text className="text-center text-muted-foreground">
        {isWord
          ? 'Removes the word, its cards and their review history on all your devices.'
          : 'Removes the card and its review history on all your devices.'}
      </Text>
      {error ? (
        <Text className="text-center text-destructive">{error}</Text>
      ) : null}
      <View className="flex-row gap-4">
        <Button variant="outline" disabled={pending} onPress={onCancel}>
          <Text>No</Text>
        </Button>
        <Button variant="destructive" loading={pending} onPress={remove}>
          <Text>Delete</Text>
        </Button>
      </View>
    </View>
  );
}
