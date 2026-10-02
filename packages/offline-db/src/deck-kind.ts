import { WORD_NOTE_TYPE } from '@repo/study';
import { languageFor } from '@repo/schemas';

// The same, as short as it gets: flags for a word deck, the type otherwise.
export function deckKindShort(deck: {
  note_type: string;
  native_language_id?: string | null;
  target_language_id?: string | null;
}): string {
  if (deck.note_type === WORD_NOTE_TYPE) {
    const native = languageFor(deck.native_language_id);
    const target = languageFor(deck.target_language_id);
    return native && target ? `${native.flag}→${target.flag}` : 'words';
  }
  return deck.note_type;
}
