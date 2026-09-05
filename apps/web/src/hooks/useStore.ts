import { useEffect, useCallback, useState, useRef } from 'react';
import type { Database } from '@remelondb/core';
import { useDatabase, useDatabaseState } from '@remelondb/core/react';
import {
  UserDeckRecord,
  UserCardRecord,
  UserNoteRecord,
  UserNoteDeckRecord,
  UserProfileRecord,
  BASIC_FRONT_BACK_TEMPLATE_KEY,
  BASIC_NOTE_FIELDS_VERSION,
  BASIC_NOTE_TYPE,
} from '@repo/offline-db';
import { useQuery } from '@remelondb/core/react';
import { useSyncController } from '@/offline/syncProvider';
import {
  getDecksQuery,
  getPersonalDictionaryQuery,
  getNotesQuery,
  getNoteDecksQuery,
  getUserProfileQuery,
  createDeck as dbCreateDeck,
  updateDeck as dbUpdateDeck,
  deleteDeck as dbDeleteDeck,
  createCard as dbCreateCard,
  updateCard as dbUpdateCard,
  createCardsBatch as dbCreateCardsBatch,
  removeNoteFromDeck as dbRemoveNoteFromDeck,
  recordReviewEvent as dbRecordReview,
  createNote as dbCreateNote,
  updateNoteFields as dbUpdateNoteFields,
  createUserProfile as dbCreateUserProfile,
  updateUserProfile as dbUpdateUserProfile,
  CreateCardsBatchOptions,
} from '@repo/offline-db';

export type Deck = UserDeckRecord;
export type Card = UserCardRecord;

export function useDelayedLoading(
  isLoading: boolean,
  { delay = 200, minDuration = 400 } = {},
) {
  const [ready, setReady] = useState(!isLoading);
  const [showSpinner, setShowSpinner] = useState(false);
  const spinnerShownAtRef = useRef<number | null>(null);

  useEffect(() => {
    let delayTimer: ReturnType<typeof setTimeout> | null = null;
    let minDurationTimer: ReturnType<typeof setTimeout> | null = null;

    if (isLoading) {
      setReady(false);
      delayTimer = setTimeout(() => {
        setShowSpinner(true);
        spinnerShownAtRef.current = Date.now();
      }, delay);
    } else {
      const spinnerShownAt = spinnerShownAtRef.current;
      if (spinnerShownAt === null) {
        setShowSpinner(false);
        setReady(true);
      } else {
        const elapsed = Date.now() - spinnerShownAt;
        const remaining = minDuration - elapsed;
        if (remaining <= 0) {
          setShowSpinner(false);
          setReady(true);
          spinnerShownAtRef.current = null;
        } else {
          minDurationTimer = setTimeout(() => {
            setShowSpinner(false);
            setReady(true);
            spinnerShownAtRef.current = null;
          }, remaining);
        }
      }
    }

    return () => {
      if (delayTimer) clearTimeout(delayTimer);
      if (minDurationTimer) clearTimeout(minDurationTimer);
    };
  }, [isLoading, delay, minDuration]);

  return { ready, showSpinner };
}

export function useStore() {
  const { status, error: managerError } = useDatabaseState();
  const sync = useSyncController();

  const db = useDatabase() as Database | null;
  const isInitializing = status === 'loading' || status === 'idle';
  const initError =
    status === 'error'
      ? managerError?.message || 'Failed to open local database'
      : null;

  const [, setTimeTrigger] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTrigger((prev) => prev + 1);
    }, 10000); // trigger re-renders every 10 seconds
    return () => clearInterval(timer);
  }, []);

  const now = Math.floor(Date.now() / 10000) * 10000;

  // Observed reactive queries using remelonDB React bridge
  const { data: decks, isLoading: decksLoading } = useQuery<UserDeckRecord>(
    db && getDecksQuery(db),
  );

  const { data: cards, isLoading: cardsLoading } = useQuery<UserCardRecord>(
    db && getPersonalDictionaryQuery(db),
  );

  const { data: notes, isLoading: notesLoading } = useQuery<UserNoteRecord>(
    db && getNotesQuery(db),
  );

  const { data: noteDecks, isLoading: noteDecksLoading } =
    useQuery<UserNoteDeckRecord>(db && getNoteDecksQuery(db));

  const { data: profiles, isLoading: profileLoading } =
    useQuery<UserProfileRecord>(db && getUserProfileQuery(db));

  const isLoading =
    isInitializing ||
    decksLoading ||
    cardsLoading ||
    notesLoading ||
    noteDecksLoading ||
    profileLoading;
  const { ready, showSpinner } = useDelayedLoading(isLoading);

  const { data: dueCards } = useQuery<UserCardRecord, UserCardRecord[]>(
    db && getPersonalDictionaryQuery(db),
    {
      select: useCallback(
        (rows: UserCardRecord[]) =>
          rows
            .filter((c) => c.due_at <= now)
            .sort((a, b) => a.due_at - b.due_at),
        [now],
      ),
    },
  );

  // Local Writes
  const createDeck = useCallback(
    async (
      title: string,
      description: string,
      options?: {
        noteType?: string;
        nativeLanguageId?: string | null;
        targetLanguageId?: string | null;
      },
    ) => {
      if (!db) throw new Error('Database not initialized');
      const result = await dbCreateDeck(db, title, description, options);
      sync?.notifyLocalWrite();
      return result;
    },
    [db, sync],
  );

  const updateDeck = useCallback(
    async (id: string, title: string, description: string) => {
      if (!db) throw new Error('Database not initialized');
      const result = await dbUpdateDeck(db, id, title, description);
      sync?.notifyLocalWrite();
      return result;
    },
    [db, sync],
  );

  const deleteDeck = useCallback(
    async (id: string) => {
      if (!db) throw new Error('Database not initialized');
      const result = await dbDeleteDeck(db, id);
      sync?.notifyLocalWrite();
      return result;
    },
    [db, sync],
  );

  const createCard = useCallback(
    async (deckId: string, front: string, back: string) => {
      if (!db) throw new Error('Database not initialized');
      const result = await dbCreateCard(db, deckId, front, back);
      sync?.notifyLocalWrite();
      return result;
    },
    [db, sync],
  );

  const updateCard = useCallback(
    async (id: string, front: string, back: string) => {
      if (!db) throw new Error('Database not initialized');
      const result = await dbUpdateCard(db, id, front, back);
      sync?.notifyLocalWrite();
      return result;
    },
    [db, sync],
  );

  const removeNoteFromDeck = useCallback(
    async (noteId: string, deckId: string) => {
      if (!db) throw new Error('Database not initialized');
      const result = await dbRemoveNoteFromDeck(db, noteId, deckId);
      sync?.notifyLocalWrite();
      return result;
    },
    [db, sync],
  );

  // The note behind a card, so a form can edit the note's own fields rather
  // than the rendered front and back a template produced from them.
  const noteForCard = useCallback(
    (card: UserCardRecord) =>
      notes.find((candidate) => candidate.id === card.note_id) ?? null,
    [notes],
  );

  const createNote = useCallback(
    async (
      deckId: string,
      noteType: string,
      fieldsVersion: number,
      fields: unknown,
    ) => {
      if (!db) throw new Error('Database not initialized');
      const result = await dbCreateNote(db, deckId, {
        noteType,
        fieldsVersion,
        fields,
      });
      sync?.notifyLocalWrite();
      return result;
    },
    [db, sync],
  );

  const updateNoteFields = useCallback(
    async (noteId: string, fields: unknown) => {
      if (!db) throw new Error('Database not initialized');
      const result = await dbUpdateNoteFields(db, noteId, fields);
      sync?.notifyLocalWrite();
      return result;
    },
    [db, sync],
  );

  const isBasicCard = useCallback(
    (card: UserCardRecord): boolean => {
      const note = notes.find((candidate) => candidate.id === card.note_id);
      return (
        note?.note_type === BASIC_NOTE_TYPE &&
        note.fields_version === BASIC_NOTE_FIELDS_VERSION &&
        card.template_key === BASIC_FRONT_BACK_TEMPLATE_KEY
      );
    },
    [notes],
  );

  const recordReview = useCallback(
    async (cardId: string, rating: number) => {
      if (!db) throw new Error('Database not initialized');
      const result = await dbRecordReview(db, cardId, rating);
      sync?.notifyLocalWrite();
      return result;
    },
    [db, sync],
  );

  const getCardsCount = useCallback(
    (deckId: string): number => {
      const noteIds = new Set(
        noteDecks
          .filter((noteDeck) => noteDeck.deck_id === deckId)
          .map((noteDeck) => noteDeck.note_id),
      );
      return cards.filter((card) => noteIds.has(card.note_id)).length;
    },
    [cards, noteDecks],
  );

  const getCardsForDeck = useCallback(
    (deckId: string): UserCardRecord[] => {
      const noteIds = new Set(
        noteDecks
          .filter((noteDeck) => noteDeck.deck_id === deckId)
          .map((noteDeck) => noteDeck.note_id),
      );
      return cards.filter((card) => noteIds.has(card.note_id));
    },
    [cards, noteDecks],
  );

  const createCardsBatch = useCallback(
    async (options: CreateCardsBatchOptions) => {
      if (!db) throw new Error('Database not initialized');
      const result = await dbCreateCardsBatch(db, options);
      sync?.notifyLocalWrite();
      return result;
    },
    [db, sync],
  );

  const reconnect = useCallback(async () => {
    window.location.reload();
  }, []);

  const createUserProfile = useCallback(
    async (profile: {
      id: string;
      username: string;
      native_language_id: string;
      target_language_id: string;
    }) => {
      if (!db) throw new Error('Database not initialized');
      const result = await dbCreateUserProfile(db, profile);
      sync?.notifyLocalWrite();
      return result;
    },
    [db, sync],
  );

  const updateUserProfile = useCallback(
    async (profile: {
      username: string;
      native_language_id: string;
      target_language_id: string;
    }) => {
      if (!db) throw new Error('Database not initialized');
      const result = await dbUpdateUserProfile(db, profile);
      sync?.notifyLocalWrite();
      return result;
    },
    [db, sync],
  );

  return {
    db,
    decks,
    cards,
    dueCards,
    status,
    isTakenOver: status === 'taken-over',
    ready,
    showSpinner,
    isLoading,
    error: initError,
    reconnect,
    createDeck,
    updateDeck,
    deleteDeck,
    createCard,
    updateCard,
    removeNoteFromDeck,
    recordReview,
    isBasicCard,
    noteForCard,
    createNote,
    updateNoteFields,
    getCardsCount,
    getCardsForDeck,
    createUserProfile,
    updateUserProfile,
    createCardsBatch,
    profile: (profiles?.[0] || null) as UserProfileRecord | null,
  };
}
