import { appSchema } from "@remelondb/core";
import { syncSchemas } from "@remelondb/core/zod";
import {
  userDecks,
  userCards,
  reviewEvents,
  UserDeckRow,
  UserCardRow,
  ReviewEventRow,
} from "./user-dictionary.js";

export const schema = appSchema({
  version: 1,
  tables: [
    userDecks,
    userCards,
    reviewEvents,
  ],
});

export const syncWireSchemas = syncSchemas({
  user_decks: UserDeckRow,
  user_cards: UserCardRow,
  review_events: ReviewEventRow,
});

export * from "./user-dictionary.js";
