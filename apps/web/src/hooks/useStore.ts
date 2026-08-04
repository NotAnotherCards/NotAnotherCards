import { useEffect, useCallback } from "react";
import { useDatabaseState } from "@remelondb/core/react";
import { UserDeckRecord, UserCardRecord } from "@repo/offline-db";
import { manager } from "../offline/db";
import { useQuery } from "../offline/reactBridge";
import {
  getDecksQuery,
  getPersonalDictionaryQuery,
  getDueCardsQuery,
  createDeck as dbCreateDeck,
  updateDeck as dbUpdateDeck,
  deleteDeck as dbDeleteDeck,
  createCard as dbCreateCard,
  updateCard as dbUpdateCard,
  deleteCard as dbDeleteCard,
  recordReviewEvent as dbRecordReview,
} from "../offline/queries";

export type Deck = UserDeckRecord;
export type Card = UserCardRecord;

export function useStore() {
  const { status, error: managerError } = useDatabaseState(manager);

  useEffect(() => {
    if (status === "idle") {
      manager.init().catch(() => {});
    }
  }, [status]);

  const db = status === "ready" ? manager.database : null;
  const isInitializing = status === "loading" || status === "idle";
  const initError =
    status === "error"
      ? managerError?.message || "Failed to open local database"
      : null;

  // Observed reactive queries using remelonDB React bridge
  const { data: decks, isLoading: decksLoading } = useQuery<UserDeckRecord>(
    () => (db ? getDecksQuery(db) : null),
    [db]
  );

  const { data: cards, isLoading: cardsLoading } = useQuery<UserCardRecord>(
    () => (db ? getPersonalDictionaryQuery(db) : null),
    [db]
  );

  const { data: dueCards, isLoading: dueLoading } = useQuery<UserCardRecord>(
    () => (db ? getDueCardsQuery(db) : null),
    [db]
  );

  // Local Writes
  const createDeck = useCallback(
    async (title: string, description: string) => {
      if (!db) throw new Error("Database not initialized");
      return await dbCreateDeck(db, title, description);
    },
    [db]
  );

  const updateDeck = useCallback(
    async (id: string, title: string, description: string) => {
      if (!db) throw new Error("Database not initialized");
      return await dbUpdateDeck(db, id, title, description);
    },
    [db]
  );

  const deleteDeck = useCallback(
    async (id: string) => {
      if (!db) throw new Error("Database not initialized");
      return await dbDeleteDeck(db, id);
    },
    [db]
  );

  const createCard = useCallback(
    async (deckId: string, front: string, back: string) => {
      if (!db) throw new Error("Database not initialized");
      return await dbCreateCard(db, deckId, front, back);
    },
    [db]
  );

  const updateCard = useCallback(
    async (id: string, front: string, back: string) => {
      if (!db) throw new Error("Database not initialized");
      return await dbUpdateCard(db, id, front, back);
    },
    [db]
  );

  const deleteCard = useCallback(
    async (id: string) => {
      if (!db) throw new Error("Database not initialized");
      return await dbDeleteCard(db, id);
    },
    [db]
  );

  const recordReview = useCallback(
    async (cardId: string, rating: number) => {
      if (!db) throw new Error("Database not initialized");
      return await dbRecordReview(db, cardId, rating);
    },
    [db]
  );

  const getCardsCount = useCallback(
    (deckId: string): number => {
      return cards.filter((c) => c.deck_id === deckId).length;
    },
    [cards]
  );

  return {
    db,
    decks,
    cards,
    dueCards,
    isLoading: isInitializing || decksLoading || cardsLoading || dueLoading,
    error: initError,
    createDeck,
    updateDeck,
    deleteDeck,
    createCard,
    updateCard,
    deleteCard,
    recordReview,
    getCardsCount,
  };
}
