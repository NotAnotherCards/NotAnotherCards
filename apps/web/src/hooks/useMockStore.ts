import { useState, useEffect } from "react";

// Use the database shared collection structure directly for Decks, defined locally for this branch
export interface Deck {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  created_at: number;
  updated_at: number;
}

// A UI Card represents the combined view of cards, word_cards, and collection assignments
export interface Card {
  id: string;
  user_id: string;
  deck_id: string;
  front: string;
  back: string;
  due_at: number;
  created_at: number;
  updated_at: number;
}

// Initial mock seed data
const initialDecks: Deck[] = [
  {
    id: "deck-spanish",
    user_id: "user-1",
    title: "Spanish Essentials",
    description:
      "Most common Spanish vocabulary and essential phrases for beginners.",
    created_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
    updated_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: "deck-web-dev",
    user_id: "user-1",
    title: "Web Dev Core Concepts",
    description:
      "Fundamental concepts of modern web engineering: DOM, CSS, HTTP, React.",
    created_at: Date.now() - 3 * 24 * 60 * 60 * 1000,
    updated_at: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
];

const initialCards: Card[] = [
  // Spanish
  {
    id: "card-es-1",
    user_id: "user-1",
    deck_id: "deck-spanish",
    front: "Hola",
    back: "Hello",
    due_at: Date.now(),
    created_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
    updated_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: "card-es-2",
    user_id: "user-1",
    deck_id: "deck-spanish",
    front: "¿Cómo estás?",
    back: "How are you?",
    due_at: Date.now(),
    created_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
    updated_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: "card-es-3",
    user_id: "user-1",
    deck_id: "deck-spanish",
    front: "Gracias",
    back: "Thank you",
    due_at: Date.now(),
    created_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
    updated_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: "card-es-4",
    user_id: "user-1",
    deck_id: "deck-spanish",
    front: "Por favor",
    back: "Please",
    due_at: Date.now(),
    created_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
    updated_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: "card-es-5",
    user_id: "user-1",
    deck_id: "deck-spanish",
    front: "Adiós",
    back: "Goodbye",
    due_at: Date.now(),
    created_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
    updated_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
  // Web Dev
  {
    id: "card-wd-1",
    user_id: "user-1",
    deck_id: "deck-web-dev",
    front: "HTTP Status 404",
    back: "Not Found",
    due_at: Date.now(),
    created_at: Date.now() - 3 * 24 * 60 * 60 * 1000,
    updated_at: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
  {
    id: "card-wd-2",
    user_id: "user-1",
    deck_id: "deck-web-dev",
    front: "React useEffect Cleanup",
    back: "A function returned by the effect to clean up resources (e.g., subscriptions, intervals) before the component unmounts or before re-running the effect.",
    due_at: Date.now(),
    created_at: Date.now() - 3 * 24 * 60 * 60 * 1000,
    updated_at: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
  {
    id: "card-wd-3",
    user_id: "user-1",
    deck_id: "deck-web-dev",
    front: "CSS Box Model",
    back: "The content, padding, border, and margin boxes that surround HTML elements.",
    due_at: Date.now(),
    created_at: Date.now() - 3 * 24 * 60 * 60 * 1000,
    updated_at: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
];

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

export function useMockStore() {
  const [, setTick] = useState(0);
  const isLoading = false;
  const [error] = useState<string | null>(null);

  useEffect(() => {
    return subscribe(() => {
      setTick((tick) => tick + 1);
    });
  }, []);

  const createDeck = (title: string, description: string): Deck => {
    const newDeck: Deck = {
      id: crypto.randomUUID(),
      user_id: "user-1",
      title,
      description: description || null,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    globalDecks = [...globalDecks, newDeck];
    saveToStorage();
    notify();
    return newDeck;
  };

  const updateDeck = (id: string, title: string, description: string) => {
    globalDecks = globalDecks.map((d) =>
      d.id === id
        ? {
            ...d,
            title,
            description: description || null,
            updated_at: Date.now(),
          }
        : d,
    );
    saveToStorage();
    notify();
  };

  const deleteDeck = (id: string) => {
    globalDecks = globalDecks.filter((d) => d.id !== id);
    globalCards = globalCards.filter((c) => c.deck_id !== id);
    saveToStorage();
    notify();
  };

  const createCard = (deck_id: string, front: string, back: string): Card => {
    const newCard: Card = {
      id: crypto.randomUUID(),
      user_id: "user-1",
      deck_id,
      front,
      back,
      due_at: Date.now(),
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    globalCards = [...globalCards, newCard];
    saveToStorage();
    notify();
    return newCard;
  };

  const updateCard = (id: string, front: string, back: string) => {
    globalCards = globalCards.map((c) =>
      c.id === id ? { ...c, front, back, updated_at: Date.now() } : c,
    );
    saveToStorage();
    notify();
  };

  const deleteCard = (id: string) => {
    globalCards = globalCards.filter((c) => c.id !== id);
    saveToStorage();
    notify();
  };

  const getCardsCount = (deck_id: string): number => {
    return globalCards.filter((c) => c.deck_id === deck_id).length;
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
