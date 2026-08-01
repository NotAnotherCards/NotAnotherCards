import { useState, useEffect, useCallback } from "react";
import { Database } from "@remelondb/core";
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

// Default seed data for first time app load when DB is empty
const defaultSeedDecks = [
  {
    title: "Spanish Essentials",
    description: "Most common Spanish vocabulary and essential phrases for beginners.",
    cards: [
      { front: "Hola", back: "Hello" },
      { front: "¿Cómo estás?", back: "How are you?" },
      { front: "Gracias", back: "Thank you" },
      { front: "Por favor", back: "Please" },
      { front: "Adiós", back: "Goodbye" },
    ],
  },
  {
    title: "Web Dev Core Concepts",
    description: "Fundamental concepts of modern web engineering: DOM, CSS, HTTP, React.",
    cards: [
      { front: "HTTP Status 404", back: "Not Found" },
      {
        front: "React useEffect Cleanup",
        back: "A function returned by the effect to clean up resources before unmounting.",
      },
      {
        front: "CSS Box Model",
        back: "Content, padding, border, and margin boxes surrounding HTML elements.",
      },
    ],
  },
];

async function seedDatabaseIfEmpty(db: Database) {
  const existingDecks = await getDecksQuery(db).fetch();
  if (existingDecks.length > 0) {
    return;
  }

  for (const seedDeck of defaultSeedDecks) {
    const deck = await dbCreateDeck(db, seedDeck.title, seedDeck.description);
    for (const card of seedDeck.cards) {
      await dbCreateCard(db, deck.id, card.front, card.back);
    }
  }
}

export function useStore() {
  const [db, setDb] = useState<Database | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initDb() {
      try {
        const database = await manager.init();
        if (mounted) {
          await seedDatabaseIfEmpty(database);
          setDb(database);
          setIsInitializing(false);
        }
      } catch (err) {
        if (mounted) {
          setInitError(
            err instanceof Error ? err.message : "Failed to open local database"
          );
          setIsInitializing(false);
        }
      }
    }

    initDb();

    return () => {
      mounted = false;
    };
  }, []);

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
