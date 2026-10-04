import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { View } from 'react-native';
import {
  parseWordFields,
  WORD_NOTE_TYPE,
  type UserNoteRecord,
} from '@repo/offline-db';
import type { Card as CardRecord } from '@/lib/cards';
import type { cardWrites } from '@/lib/card-writes';
import { toWriteError, writeErrorText, type WriteError } from '@/lib/errors';
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
  const { t } = useTranslation();
  const [error, setError] = useState<WriteError | null>(null);
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
      setError(toWriteError(err, 'mobile.messages.delete_failed'));
      setPending(false);
    }
  };

  return (
    <View className="items-center gap-4 py-12">
      <Text className="text-center text-lg font-semibold">
        {t('mobile.messages.delete_named', { title: shown })}
      </Text>
      <Text className="text-center text-muted-foreground">
        {isWord
          ? t('mobile.messages.delete_word_help')
          : t('mobile.messages.delete_card_help')}
      </Text>
      {error ? (
        <Text className="text-center text-destructive">
          {writeErrorText(error, t)}
        </Text>
      ) : null}
      <View className="flex-row gap-4">
        <Button variant="outline" disabled={pending} onPress={onCancel}>
          <Text>{t('mobile.messages.no')}</Text>
        </Button>
        <Button variant="destructive" loading={pending} onPress={remove}>
          <Text>{t('deck.card.actions.delete')}</Text>
        </Button>
      </View>
    </View>
  );
}
