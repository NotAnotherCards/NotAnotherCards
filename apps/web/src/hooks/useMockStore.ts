import { useState, useEffect } from "react";

// Use the database collection structure directly for Decks, defined locally for this branch
export interface Deck {
  id: string;
  language_id: string;
  name: string;
  description: string | null;
  level: string | null;
  is_public: boolean;
  created_by_user_id: string | null;
  created_at: number;
  updated_at: number;
}

// A UI Card represents the combined view of cards, word_cards, and collection assignments
export interface Card {
  id: string; // card_id / CardRecord.id
  collection_id: string; // DictionaryCollectionCardRecord.collection_id
  lemma: string; // WordCardRecord.lemma
  translation: string; // WordCardRecord.translation
  notes: string | null; // WordCardRecord.notes
  created_at: number; // CardRecord.created_at
}

// Initial mock seed data
const initialDecks: Deck[] = [
  {
    id: "deck-spanish",
    language_id: "lang-spanish",
    name: "Spanish Essentials",
    description: "Most common Spanish vocabulary and essential phrases for beginners.",
    level: "A1",
    is_public: true,
    created_by_user_id: "user-1",
    created_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
    updated_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: "deck-web-dev",
    language_id: "lang-english",
    name: "Web Dev Core Concepts",
    description: "Fundamental concepts of modern web engineering: DOM, CSS, HTTP, React.",
    level: null,
    is_public: true,
    created_by_user_id: "user-1",
    created_at: Date.now() - 3 * 24 * 60 * 60 * 1000,
    updated_at: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
];

const initialCards: Card[] = [
  // Spanish
  {
    id: "card-es-1",
    collection_id: "deck-spanish",
    lemma: "Hola",
    translation: "Hello",
    notes: "Basic friendly greeting.",
    created_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: "card-es-2",
    collection_id: "deck-spanish",
    lemma: "¿Cómo estás?",
    translation: "How are you?",
    notes: "Used informally with friends/family.",
    created_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: "card-es-3",
    collection_id: "deck-spanish",
    lemma: "Gracias",
    translation: "Thank you",
    notes: "Crucial polite expression.",
    created_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: "card-es-4",
    collection_id: "deck-spanish",
    lemma: "Por favor",
    translation: "Please",
    notes: "Can be placed at the start or end of requests.",
    created_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: "card-es-5",
    collection_id: "deck-spanish",
    lemma: "Adiós",
    translation: "Goodbye",
    notes: "Formal farewell. 'Chao' is more casual.",
    created_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
  // Web Dev
  {
    id: "card-wd-1",
    collection_id: "deck-web-dev",
    lemma: "HTTP Status 404",
    translation: "Not Found",
    notes: "The origin server did not find a current representation for the target resource.",
    created_at: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
  {
    id: "card-wd-2",
    collection_id: "deck-web-dev",
    lemma: "React useEffect Cleanup",
    translation: "A function returned by the effect to clean up resources (e.g., subscriptions, intervals) before the component unmounts or before re-running the effect.",
    notes: "Crucial for preventing memory leaks in single-page apps.",
    created_at: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
  {
    id: "card-wd-3",
    collection_id: "deck-web-dev",
    lemma: "CSS Box Model",
    translation: "The content, padding, border, and margin boxes that surround HTML elements.",
    notes: "box-sizing: border-box includes padding and border in the element's total width/height.",
    created_at: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
];

// Initialize global variables by reading localStorage
const STORAGE_PREFIX = "notanothercards_";
let globalDecks: Deck[] = [];
let globalCards: Card[] = [];

try {
  const savedDecks = localStorage.getItem(`${STORAGE_PREFIX}decks`);
  const savedCards = localStorage.getItem(`${STORAGE_PREFIX}cards`);

  if (savedDecks) {
    globalDecks = JSON.parse(savedDecks);
  } else {
    globalDecks = initialDecks;
    localStorage.setItem(`${STORAGE_PREFIX}decks`, JSON.stringify(globalDecks));
  }

  if (savedCards) {
    globalCards = JSON.parse(savedCards);
  } else {
    globalCards = initialCards;
    localStorage.setItem(`${STORAGE_PREFIX}cards`, JSON.stringify(globalCards));
  }
} catch (e) {
  // SSR fallback / storage disabled
  globalDecks = initialDecks;
  globalCards = initialCards;
  console.log(e);
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  listeners.forEach((listener) => listener());
}

function saveToStorage() {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}decks`, JSON.stringify(globalDecks));
    localStorage.setItem(`${STORAGE_PREFIX}cards`, JSON.stringify(globalCards));
  } catch (e) {
    console.error("Failed to write mock state to localStorage", e);
  }
}

// React Hook
export function useMockStore() {
  const [, setTick] = useState(0);
  const isLoading = false;
  const [error] = useState<string | null>(null);

  useEffect(() => {
    return subscribe(() => {
      setTick((tick) => tick + 1);
    });
  }, []);

  // CRUD helpers
  const createDeck = (name: string, description: string): Deck => {
    const newDeck: Deck = {
      id: `deck-${Date.now()}`,
      language_id: "lang-learning",
      name,
      description: description || null,
      level: null,
      is_public: true,
      created_by_user_id: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    globalDecks = [...globalDecks, newDeck];
    saveToStorage();
    notify();
    return newDeck;
  };

  const updateDeck = (id: string, name: string, description: string) => {
    globalDecks = globalDecks.map((d) =>
      d.id === id
        ? {
            ...d,
            name,
            description: description || null,
            updated_at: Date.now(),
          }
        : d
    );
    saveToStorage();
    notify();
  };

  const deleteDeck = (id: string) => {
    globalDecks = globalDecks.filter((d) => d.id !== id);
    // Cascade delete cards
    globalCards = globalCards.filter((c) => c.collection_id !== id);
    saveToStorage();
    notify();
  };

  const createCard = (
    collection_id: string,
    lemma: string,
    translation: string,
    notes?: string
  ): Card => {
    const newCard: Card = {
      id: `card-${Date.now()}`,
      collection_id,
      lemma,
      translation,
      notes: notes || null,
      created_at: Date.now(),
    };
    globalCards = [...globalCards, newCard];
    saveToStorage();
    notify();
    return newCard;
  };

  const updateCard = (id: string, lemma: string, translation: string, notes?: string) => {
    globalCards = globalCards.map((c) =>
      c.id === id ? { ...c, lemma, translation, notes: notes || null } : c
    );
    saveToStorage();
    notify();
  };

  const deleteCard = (id: string) => {
    globalCards = globalCards.filter((c) => c.id !== id);
    saveToStorage();
    notify();
  };

  const getCardsCount = (collection_id: string): number => {
    return globalCards.filter((c) => c.collection_id === collection_id).length;
  };

  return {
    decks: globalDecks,
    cards: globalCards,
    createDeck,
    updateDeck,
    deleteDeck,
    createCard,
    updateCard,
    deleteCard,
    getCardsCount,
    isLoading,
    error,
  };
}
