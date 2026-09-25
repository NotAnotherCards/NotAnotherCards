import {
  BASIC_FRONT_BACK_TEMPLATE_KEY,
  BASIC_NOTE_FIELDS_VERSION,
  BASIC_NOTE_TYPE,
  type UserCardRecord,
  type UserNoteRecord,
} from '@repo/offline-db';

// Only a basic note's front-back card is editable through the front/back
// form (web's rule). Anything else, once #194 adds note types, shows in the
// list but keeps its own editor.
export function isBasicCard(
  card: UserCardRecord,
  notesById: ReadonlyMap<string, UserNoteRecord>,
): boolean {
  const note = notesById.get(card.note_id);
  return (
    note?.note_type === BASIC_NOTE_TYPE &&
    note.fields_version === BASIC_NOTE_FIELDS_VERSION &&
    card.template_key === BASIC_FRONT_BACK_TEMPLATE_KEY
  );
}
