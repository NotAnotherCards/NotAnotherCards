import { BASIC_NOTE_TYPE, WORD_NOTE_TYPE } from '@repo/offline-db';
import { languageFor, languageLabel } from '@repo/schemas';

// What kind of deck this is, since the type is chosen once and decides which
// form opens: a word deck names its pair as the learner reads it, from their
// language to the one they learn; anything else names its type.
export function deckKind(deck: {
  note_type: string;
  native_language_id?: string | null;
  target_language_id?: string | null;
}): string {
  if (deck.note_type === WORD_NOTE_TYPE) {
    const native = languageFor(deck.native_language_id);
    const target = languageFor(deck.target_language_id);
    return native && target
      ? `${languageLabel(native)} → ${languageLabel(target)}`
      : 'Word deck';
  }
  if (deck.note_type === BASIC_NOTE_TYPE) return 'Card deck';
  return `Unknown deck type: ${deck.note_type}`;
}

export const deckKindClassName =
  'text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40';

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
