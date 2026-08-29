import { syncSchemas } from '@remelondb/core/zod';
import {
  ReviewEventRow,
  UserCardRow,
  UserDeckRow,
  UserProfileRow,
} from './user-dictionary.js';

export const syncWireSchemas = syncSchemas({
  user_decks: UserDeckRow,
  user_cards: UserCardRow,
  review_events: ReviewEventRow,
  user_profiles: UserProfileRow,
});
