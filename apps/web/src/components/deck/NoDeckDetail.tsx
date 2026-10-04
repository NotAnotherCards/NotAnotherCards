import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Trash2 } from 'lucide-react';
import {
  deckLearningCounts,
  parseWordFields,
  type UserNoteRecord,
} from '@repo/offline-db';
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
import { BasicCardView } from './BasicCardView';
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
  const [editingWordNote, setEditingWordNote] =
    useState<UserNoteRecord | null>(null);
  const [viewingWordNote, setViewingWordNote] =
    useState<UserNoteRecord | null>(null);
  const [viewingCard, setViewingCard] = useState<Card | null>(null);
  const [noteIdToDelete, setNoteIdToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const cards = store.getCardsWithoutDeck();
  const wordNotes = store.notes.filter((note) =>
    cards.some((card) => card.note_id === note.id && store.isWordCard(card)),
  );
  const learningCounts = useMemo(
    () => deckLearningCounts(cards, wordNotes.map((note) => note.id)),
    [cards, wordNotes],
  );
  const basicCards = cards.filter(store.isBasicCard);
  const isDeletingWord =
    noteIdToDelete !== null &&
    wordNotes.some((note) => note.id === noteIdToDelete);
  const viewingWordRow = viewingWordNote
    ? toWordRow(
        viewingWordNote,
        cards.filter((card) => card.note_id === viewingWordNote.id),
      )
    : null;
  const editingWordFields = editingWordNote
    ? parseWordFields(editingWordNote)
    : null;

  const handleEdit = (card: Card) => {
    if (store.isBasicCard(card)) setEditingCard(card);
    else if (store.isWordCard(card)) {
      const note = store.noteForCard(card);
      if (note) setEditingWordNote(note);
    }
  };

  const handleEditCard = async (data: { front: string; back: string }) => {
    if (!editingCard) return;
    setWriteError(null);
    try {
      await store.updateCard(editingCard.id, data.front, data.back);
      setEditingCard(null);
    } catch (err) {
      setWriteError(writeErrorMessage(err, 'Failed to update card'));
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
      setWriteError(writeErrorMessage(err, 'Failed to update word'));
    }
  };

  const handleDelete = async () => {
    if (!noteIdToDelete) return;
    setIsDeleting(true);
    setWriteError(null);
    try {
      await store.deleteNote(noteIdToDelete);
      setNoteIdToDelete(null);
      if (!cards.some((card) => card.note_id !== noteIdToDelete)) onBack();
    } catch (err) {
      setWriteError(writeErrorMessage(err, 'Failed to delete card'));
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
              {t('deck.list.no_deck_title', 'No deck')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              {t(
                'deck.list.no_deck_description',
                'Cards that are not in an active deck.',
              )}
            </p>
          </div>
        </div>
      </div>

      <WordNoteList
        notes={wordNotes}
        cards={cards}
        basicCards={basicCards}
        activeWordCount={learningCounts.activeNotes}
        totalCardCount={learningCounts.totalCards}
        dueCardCount={learningCounts.dueCards}
        onViewNote={setViewingWordNote}
        onEditWord={setEditingWordNote}
        onRemoveWord={(note) => setNoteIdToDelete(note.id)}
        onViewCard={setViewingCard}
        onEditCard={handleEdit}
        onRemoveCard={(card) => setNoteIdToDelete(card.note_id)}
        canEdit
        canRemove
        canAddWord={false}
        onAddWord={() => undefined}
        removeWordTitle={t('deck.no_deck.delete_word', 'Delete word')}
        removeWordLabel={t('deck.no_deck.delete_word', 'Delete word')}
        removeWordIcon="delete"
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
          title="Edit Word"
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
        <BasicCardView
          front={viewingCard.front}
          back={viewingCard.back}
          onClose={() => setViewingCard(null)}
          onEdit={() => {
            setViewingCard(null);
            setEditingCard(viewingCard);
          }}
        />
      )}

      {noteIdToDelete && (
        <WordNoteDialog
          label={
            isDeletingWord
              ? t('deck.no_deck.delete_word_title', 'Delete word?')
              : t('deck.no_deck.delete_title', 'Delete card?')
          }
          onClose={() => {
            if (!isDeleting) setNoteIdToDelete(null);
          }}
          className="max-w-sm border-destructive/20"
        >
          <CardHeader>
            <CardTitle className="text-lg font-bold text-destructive flex items-center gap-2">
              <Trash2 className="size-5" />
              {isDeletingWord
                ? t('deck.no_deck.delete_word_title', 'Delete word?')
                : t('deck.no_deck.delete_title', 'Delete card?')}
            </CardTitle>
            <CardDescription>
              {isDeletingWord
                ? t(
                    'deck.no_deck.delete_word_description',
                    'This permanently deletes the word, all of its cards, and its review history.',
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
                onClick={() => setNoteIdToDelete(null)}
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
    </div>
  );
}
