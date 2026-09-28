/** Stable identity constants for the built-in basic note contract. */
export const BASIC_NOTE_TYPE = 'basic';
export const BASIC_NOTE_FIELDS_VERSION = 1;

/** Stable identity constants for the word note contract (#194). */
export const WORD_NOTE_TYPE = 'word';
export const WORD_NOTE_FIELDS_VERSION = 1;

export const DECK_NOTE_TYPES = [BASIC_NOTE_TYPE, WORD_NOTE_TYPE] as const;
export type DeckNoteType = (typeof DECK_NOTE_TYPES)[number];

export const DECK_NOTE_TYPE_OPTIONS = [
  {
    value: BASIC_NOTE_TYPE,
    label: 'Cards',
    description: 'A front and a back',
  },
  {
    value: WORD_NOTE_TYPE,
    label: 'Words',
    description: 'A word, its translation, and more',
  },
] as const;
