import { useState, useEffect } from "react";

export interface Deck {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  notes?: string;
  createdAt: string;
}

// Initial mock seed data
const initialDecks: Deck[] = [
  {
    id: "deck-spanish",
    name: "Spanish Essentials",
    description: "Most common Spanish vocabulary and essential phrases for beginners.",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "deck-web-dev",
    name: "Web Dev Core Concepts",
    description: "Fundamental concepts of modern web engineering: DOM, CSS, HTTP, React.",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const initialCards: Card[] = [
  // Spanish
  {
    id: "card-es-1",
    deckId: "deck-spanish",
    front: "Hola",
    back: "Hello",
    notes: "Basic friendly greeting.",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "card-es-2",
    deckId: "deck-spanish",
    front: "¿Cómo estás?",
    back: "How are you?",
    notes: "Used informally with friends/family.",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "card-es-3",
    deckId: "deck-spanish",
    front: "Gracias",
    back: "Thank you",
    notes: "Crucial polite expression.",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "card-es-4",
    deckId: "deck-spanish",
    front: "Por favor",
    back: "Please",
    notes: "Can be placed at the start or end of requests.",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "card-es-5",
    deckId: "deck-spanish",
    front: "Adiós",
    back: "Goodbye",
    notes: "Formal farewell. 'Chao' is more casual.",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  // Web Dev
  {
    id: "card-wd-1",
    deckId: "deck-web-dev",
    front: "HTTP Status 404",
    back: "Not Found",
    notes: "The origin server did not find a current representation for the target resource.",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "card-wd-2",
    deckId: "deck-web-dev",
    front: "React useEffect Cleanup",
    back: "A function returned by the effect to clean up resources (e.g., subscriptions, intervals) before the component unmounts or before re-running the effect.",
    notes: "Crucial for preventing memory leaks in single-page apps.",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "card-wd-3",
    deckId: "deck-web-dev",
    front: "CSS Box Model",
    back: "The content, padding, border, and margin boxes that surround HTML elements.",
    notes: "box-sizing: border-box includes padding and border in the element's total width/height.",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
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
  console.log(e)
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

  useEffect(() => {
    return subscribe(() => {
      setTick((tick) => tick + 1);
    });
  }, []);

  // CRUD helpers
  const createDeck = (name: string, description: string): Deck => {
    const newDeck: Deck = {
      id: `deck-${Date.now()}`,
      name,
      description,
      createdAt: new Date().toISOString(),
    };
    globalDecks = [...globalDecks, newDeck];
    saveToStorage();
    notify();
    return newDeck;
  };

  const updateDeck = (id: string, name: string, description: string) => {
    globalDecks = globalDecks.map((d) =>
      d.id === id ? { ...d, name, description } : d
    );
    saveToStorage();
    notify();
  };

  const deleteDeck = (id: string) => {
    globalDecks = globalDecks.filter((d) => d.id !== id);
    // Cascade delete cards
    globalCards = globalCards.filter((c) => c.deckId !== id);
    saveToStorage();
    notify();
  };

  const createCard = (
    deckId: string,
    front: string,
    back: string,
    notes?: string
  ): Card => {
    const newCard: Card = {
      id: `card-${Date.now()}`,
      deckId,
      front,
      back,
      notes,
      createdAt: new Date().toISOString(),
    };
    globalCards = [...globalCards, newCard];
    saveToStorage();
    notify();
    return newCard;
  };

  const updateCard = (id: string, front: string, back: string, notes?: string) => {
    globalCards = globalCards.map((c) =>
      c.id === id ? { ...c, front, back, notes } : c
    );
    saveToStorage();
    notify();
  };

  const deleteCard = (id: string) => {
    globalCards = globalCards.filter((c) => c.id !== id);
    saveToStorage();
    notify();
  };

  const getCardsCount = (deckId: string): number => {
    return globalCards.filter((c) => c.deckId === deckId).length;
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
  };
}
