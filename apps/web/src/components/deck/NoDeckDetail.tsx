import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Trash2 } from 'lucide-react';
import {
  deckLearningCounts,
  parseWordFields,
  type UserNoteRecord,
} from '@repo/offline-db';
import {
  isBasicCard as isBasicNoteCard,
  WORD_NOTE_FIELDS_VERSION,
  WORD_NOTE_TYPE,
} from '@repo/study';
import { useStore, type Card } from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CardForm } from './CardForm';
import { WordNoteList } from './WordNoteList';
import { WordNoteView } from './WordNoteView';
import { FlashcardModal } from './FlashcardModal';
import { toWordRow } from './word-note-rows';
import { FormErrorMessage } from '@/components/auth/form-error-message';
import { WordNoteForm, type WordFormValues } from './WordNoteForm';
import { WordNoteDialog } from './WordNoteDialog';
import { writeErrorMessage } from '@/lib/write-error';

interface NoDeckDetailProps {
  onBack: () => void;
}

export function NoDeckDetail({ onBack }: NoDeckDetailProps) {
  const { t } = useTranslation();
  const store = useStore();
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editingWordNote, setEditingWordNote] = useState<UserNoteRecord | null>(
    null,
  );
  const [viewingWordNote, setViewingWordNote] = useState<UserNoteRecord | null>(
    null,
  );
  const [viewingCard, setViewingCard] = useState<Card | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<{
    id: string;
    kind: 'card' | 'word' | 'note';
  } | null>(null);
  const [bulkDeleteStage, setBulkDeleteStage] = useState<
    'confirm' | 'final' | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const cards = store.getCardsWithoutDeck();
  const cardsByNoteId = useMemo(() => {
    const result = new Map<string, Card[]>();
    for (const card of cards) {
      const noteCards = result.get(card.note_id) ?? [];
      noteCards.push(card);
      result.set(card.note_id, noteCards);
    }
    return result;
  }, [cards]);
  const notesById = useMemo(
    () => new Map(store.notes.map((note) => [note.id, note])),
    [store.notes],
  );
  const notesWithCards = useMemo(
    () =>
      [...cardsByNoteId.keys()]
        .map((noteId) => notesById.get(noteId))
        .filter((note): note is UserNoteRecord => note !== undefined),
    [cardsByNoteId, notesById],
  );
  const { wordNotes, basicCards, unparsedNotes } = useMemo(() => {
    const wordNotes: UserNoteRecord[] = [];
    const basicCards: Card[] = [];
    const unparsedNotes: UserNoteRecord[] = [];

    for (const note of notesWithCards) {
      const noteCards = cardsByNoteId.get(note.id) ?? [];
      const isWordNote =
        note.note_type === WORD_NOTE_TYPE &&
        note.fields_version === WORD_NOTE_FIELDS_VERSION &&
        parseWordFields(note) !== null;

      if (isWordNote) {
        wordNotes.push(note);
        continue;
      }

      const noteBasicCards = noteCards.filter((card) =>
        isBasicNoteCard(card, note),
      );
      if (noteBasicCards.length > 0) {
        basicCards.push(...noteBasicCards);
      } else {
        unparsedNotes.push(note);
      }
    }

    for (const card of cards) {
      if (!notesById.has(card.note_id)) basicCards.push(card);
    }

    return { wordNotes, basicCards, unparsedNotes };
  }, [cards, cardsByNoteId, notesById, notesWithCards]);
  const learningCounts = useMemo(
    () =>
      deckLearningCounts(
        cards,
        wordNotes.map((note) => note.id),
      ),
    [cards, wordNotes],
  );
  const viewingWordRow = viewingWordNote
    ? toWordRow(viewingWordNote, cardsByNoteId.get(viewingWordNote.id) ?? [])
    : null;
  const editingWordFields = editingWordNote
    ? parseWordFields(editingWordNote)
    : null;

  const handleEdit = (card: Card) => {
    const note = notesById.get(card.note_id);
    if (!note || isBasicNoteCard(card, note)) setEditingCard(card);
    else if (
      note.note_type === WORD_NOTE_TYPE &&
      note.fields_version === WORD_NOTE_FIELDS_VERSION &&
      parseWordFields(note) !== null
    )
      setEditingWordNote(note);
  };

  const handleEditCard = async (data: { front: string; back: string }) => {
    if (!editingCard) return;
    setWriteError(null);
    try {
      await store.updateCard(editingCard.id, data.front, data.back);
      setEditingCard(null);
    } catch (err) {
      setWriteError(
        writeErrorMessage(err, t('deck.no_deck.update_card_failed')),
      );
    }
  };

  const handleEditWord = async (values: WordFormValues) => {
    if (!editingWordNote || !editingWordFields) return;
    setWriteError(null);
    try {
      await store.updateNoteFields(editingWordNote.id, {
        ...values,
        native_language_id: editingWordFields.native_language_id,
        target_language_id: editingWordFields.target_language_id,
        ...(editingWordFields.image ? { image: editingWordFields.image } : {}),
        ...(editingWordFields.word_audio
          ? { word_audio: editingWordFields.word_audio }
          : {}),
      });
      setEditingWordNote(null);
    } catch (err) {
      setWriteError(
        writeErrorMessage(err, t('deck.no_deck.update_word_failed')),
      );
    }
  };

  const handleDelete = async () => {
    if (!noteToDelete) return;
    setIsDeleting(true);
    setWriteError(null);
    try {
      await store.deleteNote(noteToDelete.id);
      setNoteToDelete(null);
      if (!cards.some((card) => card.note_id !== noteToDelete.id)) onBack();
    } catch (err) {
      setWriteError(writeErrorMessage(err, t('deck.no_deck.delete_failed')));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    setWriteError(null);
    try {
      await store.deleteNotes([...cardsByNoteId.keys()]);
      setBulkDeleteStage(null);
      onBack();
    } catch (err) {
      setWriteError(writeErrorMessage(err, t('deck.no_deck.delete_failed')));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 bg-muted/20 p-5 rounded-3xl border border-border/40">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="cursor-pointer gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {t('deck.detail.back_to_decks', 'Back to Decks')}
          </Button>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground font-heading">
              {t('deck.list.no_deck_title', 'Cards and words without a deck')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              {t(
                'deck.list.no_deck_description',
                'Cards that are not in an active deck.',
              )}
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => {
              setWriteError(null);
              setBulkDeleteStage('confirm');
            }}
            className="cursor-pointer gap-1.5 justify-center self-stretch md:self-auto"
          >
            <Trash2 className="size-4" />
            {t('deck.no_deck.delete_all_action', { count: cards.length })}
          </Button>
        </div>
      </div>

      <WordNoteList
        notes={[...wordNotes, ...unparsedNotes]}
        cards={cards}
        basicCards={basicCards}
        wordCount={wordNotes.length}
        activeWordCount={learningCounts.activeNotes}
        totalCardCount={learningCounts.totalCards}
        dueCardCount={learningCounts.dueCards}
        onViewNote={setViewingWordNote}
        onEditWord={setEditingWordNote}
        onRemoveWord={(note) =>
          setNoteToDelete({
            id: note.id,
            kind: wordNotes.some((word) => word.id === note.id)
              ? 'word'
              : 'note',
          })
        }
        onViewCard={setViewingCard}
        onEditCard={handleEdit}
        onRemoveCard={(card) =>
          setNoteToDelete({ id: card.note_id, kind: 'card' })
        }
        canEdit
        canRemove
        canAddWord={false}
        onAddWord={() => undefined}
        removeWordTitle={t('deck.no_deck.delete_word', 'Delete word')}
        removeWordLabel={t('deck.no_deck.delete_word', 'Delete word')}
        removeWordIcon="delete"
        removeInvalidNoteTitle={t('deck.no_deck.delete_note', 'Delete note')}
        removeInvalidNoteLabel={t('deck.no_deck.delete_note', 'Delete note')}
        searchPlaceholder={t('deck.no_deck.search_placeholder', 'Search')}
        firstColumnLabel={t('deck.no_deck.col_question', 'Word / Question')}
        secondColumnLabel={t('deck.no_deck.col_answer', 'Translation / Answer')}
      />

      {editingCard && (
        <CardForm
          title={t('deck.card_form.edit_card', 'Edit Card')}
          initialData={{ front: editingCard.front, back: editingCard.back }}
          onSubmit={handleEditCard}
          error={writeError}
          onCancel={() => setEditingCard(null)}
        />
      )}

      {editingWordNote && editingWordFields && (
        <WordNoteForm
          title={t('deck.word_view.edit_word', 'Edit Word')}
          alwaysShowDetails
          targetLanguageId={editingWordFields.target_language_id}
          nativeLanguageId={editingWordFields.native_language_id}
          initialData={editingWordFields}
          onSubmit={handleEditWord}
          error={writeError}
          onCancel={() => setEditingWordNote(null)}
        />
      )}

      {viewingWordNote && viewingWordRow && (
        <WordNoteView
          fields={viewingWordRow.fields}
          cards={viewingWordRow.badges}
          onClose={() => setViewingWordNote(null)}
          onEdit={() => {
            setViewingWordNote(null);
            setEditingWordNote(viewingWordNote);
          }}
        />
      )}

      {viewingCard && (
        <FlashcardModal
          card={viewingCard}
          onClose={() => setViewingCard(null)}
        />
      )}

      {noteToDelete && (
        <WordNoteDialog
          label={
            noteToDelete.kind === 'word'
              ? t('deck.no_deck.delete_word_title', 'Delete word?')
              : noteToDelete.kind === 'note'
                ? t('deck.no_deck.delete_note_title', 'Delete note?')
                : t('deck.no_deck.delete_title', 'Delete card?')
          }
          onClose={() => {
            if (!isDeleting) setNoteToDelete(null);
          }}
          className="max-w-sm border-destructive/20"
        >
          <CardHeader>
            <CardTitle className="text-lg font-bold text-destructive flex items-center gap-2">
              <Trash2 className="size-5" />
              {noteToDelete.kind === 'word'
                ? t('deck.no_deck.delete_word_title', 'Delete word?')
                : noteToDelete.kind === 'note'
                  ? t('deck.no_deck.delete_note_title', 'Delete note?')
                  : t('deck.no_deck.delete_title', 'Delete card?')}
            </CardTitle>
            <CardDescription>
              {noteToDelete.kind === 'word'
                ? t(
                    'deck.no_deck.delete_word_description',
                    'This permanently deletes the word, all of its cards, and its review history.',
                  )
                : noteToDelete.kind === 'note'
                  ? t(
                      'deck.no_deck.delete_note_description',
                      'This permanently deletes the note, its cards, and its review history.',
                    )
                  : t(
                      'deck.no_deck.delete_description',
                      'This permanently deletes the card, its note, and its review history.',
                    )}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <FormErrorMessage message={writeError} className="mb-4" />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={isDeleting}
                onClick={() => setNoteToDelete(null)}
                className="cursor-pointer"
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                variant="destructive"
                disabled={isDeleting}
                onClick={() => void handleDelete()}
                className="cursor-pointer"
              >
                {t('common.delete', 'Delete')}
              </Button>
            </div>
          </CardContent>
        </WordNoteDialog>
      )}

      {bulkDeleteStage && (
        <WordNoteDialog
          label={
            bulkDeleteStage === 'final'
              ? t('deck.no_deck.delete_all_final_title', {
                  count: cards.length,
                })
              : t('deck.no_deck.delete_all_title', { count: cards.length })
          }
          onClose={() => {
            if (!isDeleting) setBulkDeleteStage(null);
          }}
          className="max-w-sm border-destructive/20"
        >
          <CardHeader>
            <CardTitle className="text-lg font-bold text-destructive flex items-center gap-2">
              <Trash2 className="size-5" />
              {bulkDeleteStage === 'final'
                ? t('deck.no_deck.delete_all_final_title', {
                    count: cards.length,
                  })
                : t('deck.no_deck.delete_all_title', { count: cards.length })}
            </CardTitle>
            <CardDescription>
              {bulkDeleteStage === 'final'
                ? t('deck.no_deck.delete_all_final_description')
                : t('deck.no_deck.delete_all_description', {
                    count: cards.length,
                  })}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <FormErrorMessage message={writeError} className="mb-4" />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={isDeleting}
                onClick={() =>
                  bulkDeleteStage === 'final'
                    ? setBulkDeleteStage('confirm')
                    : setBulkDeleteStage(null)
                }
                className="cursor-pointer"
              >
                {bulkDeleteStage === 'final'
                  ? t('deck.form.back')
                  : t('common.cancel', 'Cancel')}
              </Button>
              <Button
                variant="destructive"
                disabled={isDeleting}
                onClick={() =>
                  bulkDeleteStage === 'final'
                    ? void handleDeleteAll()
                    : setBulkDeleteStage('final')
                }
                className="cursor-pointer"
              >
                {bulkDeleteStage === 'final'
                  ? t('common.delete', 'Delete')
                  : t('deck.no_deck.delete_all_continue')}
              </Button>
            </div>
          </CardContent>
        </WordNoteDialog>
      )}
    </div>
  );
}
