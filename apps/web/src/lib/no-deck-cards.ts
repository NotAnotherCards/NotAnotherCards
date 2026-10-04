import type { UserCardRecord, UserNoteDeckRecord } from '@repo/offline-db';

export function cardsWithoutActiveDeck<T extends Pick<UserCardRecord, 'note_id'>>(
  cards: readonly T[],
  memberships: readonly Pick<UserNoteDeckRecord, 'note_id' | 'active'>[],
): T[] {
  const noteIdsInActiveDeck = new Set(
    memberships
      .filter((membership) => membership.active)
      .map((membership) => membership.note_id),
  );
  return cards.filter((card) => !noteIdsInActiveDeck.has(card.note_id));
}
