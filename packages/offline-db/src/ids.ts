import { v5 as uuidv5 } from 'uuid';

// These namespaces and the JSON tuple encoding are sync protocol constants.
// Changing either would derive different IDs for rows that already exist.
const USER_CARD_NAMESPACE = '64ccd33d-9f27-51d8-81d5-33c31dbfbfa1';
const USER_NOTE_DECK_NAMESPACE = '59fbbffd-28d0-5987-8111-3de4f9cb01f6';
const SYSTEM_DECK_NAMESPACE = 'd3b76c8c-4a34-4a4b-9d41-bf17b3a1a6b0';

// A template key is half of the tuple hashed by cardId, so changing it would
// derive a different card ID for the built-in basic note.
export const BASIC_FRONT_BACK_TEMPLATE_KEY = 'front-back';

function tupleId(namespace: string, first: string, second: string): string {
  return uuidv5(JSON.stringify([first, second]), namespace);
}

export function cardId(noteId: string, templateKey: string): string {
  return tupleId(USER_CARD_NAMESPACE, noteId, templateKey);
}

export function noteDeckId(noteId: string, deckId: string): string {
  return tupleId(USER_NOTE_DECK_NAMESPACE, noteId, deckId);
}

export function systemDeckId(type: 'cards' | 'words', targetLanguage?: string): string {
  if (type === 'words' && !targetLanguage) {
    throw new Error('A words system deck requires a target language');
  }
  return tupleId(SYSTEM_DECK_NAMESPACE, type, targetLanguage || '');
}
