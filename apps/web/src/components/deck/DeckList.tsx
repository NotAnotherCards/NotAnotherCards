import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore, Deck } from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  Plus,
  Library,
  BookOpen,
  AlertCircle,
  Loader2,
  Trash2,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import { DeckForm } from './DeckForm';
import { DeckCard } from './DeckCard';
import { writeErrorMessage } from '@/lib/write-error';
import { FormErrorMessage } from '@/components/auth/form-error-message';
import {
  countCardsPerDeck,
  deckLearningCounts,
  type DeckNoteType,
  WORD_NOTE_TYPE,
} from '@repo/offline-db';

function Count({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center">
      <div className="flex min-h-8 items-center justify-center text-xs leading-4 font-medium text-foreground">
        {label}
      </div>
      <span className="text-sm font-bold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}

interface DeckListProps {
  onSelectDeck: (deckId: string) => void;
  onSelectNoDeck: () => void;
  onStartReview: (deckId: string) => void;
  onStartNoDeckReview?: () => void;
}

export function DeckList({
  onSelectDeck,
  onSelectNoDeck,
  onStartReview,
  onStartNoDeckReview,
}: DeckListProps) {
  const { t } = useTranslation();
  const store = useStore();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [deckToDelete, setDeckToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmCards, setConfirmCards] = useState(false);
  const [deletionSummary, setDeletionSummary] = useState<Awaited<
    ReturnType<typeof store.deckDeletionSummary>
  > | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const dueCardsPerDeck = countCardsPerDeck(
    store.noteDecks ?? [],
    store.dueCards ?? [],
  );
  const cardsWithoutDeck = store.getCardsWithoutDeck();
  const dueCardsWithoutDeck = cardsWithoutDeck.filter((card) =>
    (store.dueCards ?? []).some((dueCard) => dueCard.id === card.id),
  ).length;
  const { deckDeletionSummary } = store;
  useEffect(() => {
    if (!deckToDelete) return;
    let cancelled = false;
    void deckDeletionSummary(deckToDelete).then(
      (summary) => {
        if (!cancelled) setDeletionSummary(summary);
      },
      (err: unknown) => {
        if (!cancelled)
          setWriteError(writeErrorMessage(err, 'Failed to count cards'));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [deckToDelete, deckDeletionSummary]);

  const isWordDeck = deckToDelete
    ? store.decks.find((d) => d.id === deckToDelete)?.note_type === 'word'
    : false;

  // the dialog is dismissed only once the write lands, so a failed write is
  // never reported to the user as a success
  const handleCreateDeck = async (data: {
    title: string;
    description: string;
    noteType: DeckNoteType;
    nativeLanguageId: string | null;
    targetLanguageId: string | null;
  }) => {
    setWriteError(null);
    try {
      await store.createDeck(data.title, data.description, {
        noteType: data.noteType,
        nativeLanguageId: data.nativeLanguageId,
        targetLanguageId: data.targetLanguageId,
      });
      setShowCreateForm(false);
    } catch (err) {
      setWriteError(writeErrorMessage(err, 'Failed to create deck'));
    }
  };

  const handleEditDeck = async (data: {
    title: string;
    description: string;
  }) => {
    if (!editingDeck) return;
    setWriteError(null);
    try {
      await store.updateDeck(editingDeck.id, data.title, data.description);
      setEditingDeck(null);
    } catch (err) {
      setWriteError(writeErrorMessage(err, 'Failed to update deck'));
    }
  };

  const handleDeleteDeck = async (withNotes: boolean) => {
    if (!deckToDelete) return;
    setIsDeleting(true);
    setWriteError(null);
    try {
      if (withNotes) await store.deleteDeckWithNotes(deckToDelete);
      else await store.deleteDeck(deckToDelete);
      setDeckToDelete(null);
    } catch (err) {
      setWriteError(writeErrorMessage(err, 'Failed to delete deck'));
    } finally {
      setIsDeleting(false);
    }
  };

  if (store.isTakenOver) {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-3xl border border-amber-500/30 bg-amber-500/10 text-center min-h-65 space-y-4 animate-in fade-in duration-200">
        <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
          <AlertCircle className="size-8" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-amber-900 dark:text-amber-200">
            Database Inactive (Taken Over)
          </h3>
          <p className="text-sm text-amber-800/80 dark:text-amber-300/80 mt-1 max-w-md">
            This tab is currently inactive because the offline database is open
            in another tab. Click below to use the database in this window.
          </p>
        </div>
        <Button
          onClick={() => window.location.reload()}
          className="cursor-pointer gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-medium border-none shadow-sm"
        >
          <RefreshCw className="size-4" />
          Use here instead
        </Button>
      </div>
    );
  }

  if (!store.ready) {
    if (store.showSpinner) {
      return (
        <div className="flex flex-col items-center justify-center min-h-80 space-y-4 animate-in fade-in duration-300">
          <Loader2 className="animate-spin size-8 text-primary" />
          <p className="text-sm font-semibold text-foreground animate-pulse">
            Connecting Local Database...
          </p>
          <p className="text-xs text-muted-foreground">
            Initializing offline storage handles and loading library.
          </p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/20 p-4 rounded-3xl border border-border/40">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary">
            <Library className="size-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground font-heading">
              {t('deck.list.my_library')}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t('deck.list.my_library_desc', 'Manage your custom card decks.')}
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="cursor-pointer gap-1.5 self-start sm:self-center"
        >
          <Plus className="size-4" />
          {t('deck.list.create_deck')}
        </Button>
      </div>

      {/* Decks Grid */}
      {store.decks.length === 0 && cardsWithoutDeck.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 rounded-3xl border border-dashed border-border/85 bg-muted/10 text-center min-h-75">
          <BookOpen className="size-12 text-muted-foreground/60 mb-4 stroke-1 animate-bounce" />
          <h3 className="text-lg font-semibold mb-1">
            {t('deck.list.no_decks_title', 'No Decks Yet')}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            {t('deck.list.no_decks_empty')}
          </p>
          <Button
            onClick={() => setShowCreateForm(true)}
            className="cursor-pointer"
          >
            {t('deck.list.create_first', 'Create First Deck')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cardsWithoutDeck.length > 0 && (
            <Card className="border border-amber-500/40 bg-amber-500/5 flex flex-col justify-between">
              <CardHeader className="min-w-0 pb-3">
                <CardTitle className="text-base font-bold">
                  {t('deck.list.no_deck_title', 'No deck')}
                </CardTitle>
                <CardDescription className="text-xs min-h-8 mt-1">
                  {t(
                    'deck.list.no_deck_description',
                    'Cards that are not in an active deck.',
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 divide-x divide-border/40 gap-2 rounded-2xl border border-border/30 bg-muted/40 px-3 py-2 text-center">
                  <Count
                    label={t('deck.card.total_cards', 'Total Cards')}
                    value={cardsWithoutDeck.length}
                  />
                  <Count
                    label={t('deck.card.active', 'Active')}
                    value={cardsWithoutDeck.filter((card) => card.active).length}
                  />
                  <Count
                    label={t('deck.card.due_short', 'Due')}
                    value={dueCardsWithoutDeck}
                  />
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    onClick={onSelectNoDeck}
                    className="w-full cursor-pointer gap-1.5"
                    size="sm"
                  >
                    <FolderOpen className="size-3.5" />
                    {t('deck.card.actions.manage_cards', 'Manage Cards')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={onStartNoDeckReview}
                    className="w-full cursor-pointer gap-1.5"
                    size="sm"
                  >
                    <BookOpen className="size-3.5" />
                    {t('deck.card.actions.start_review', 'Start Review')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          {store.decks.map((deck) => {
            const cards = store.getCardsForDeck(deck.id);
            const wordNotes =
              deck.note_type === WORD_NOTE_TYPE
                ? store.getNotesForDeck(deck.id)
                : [];
            const counts = deckLearningCounts(
              cards,
              wordNotes.map((note) => note.id),
            );

            return (
              <DeckCard
                key={deck.id}
                deck={deck}
                totalCards={counts.totalCards}
                activeCards={counts.activeCards}
                totalWords={
                  deck.note_type === WORD_NOTE_TYPE
                    ? counts.totalNotes
                    : undefined
                }
                activeWords={
                  deck.note_type === WORD_NOTE_TYPE
                    ? counts.activeNotes
                    : undefined
                }
                dueCount={dueCardsPerDeck.get(deck.id) ?? 0}
                onSelectDeck={onSelectDeck}
                onStartReview={onStartReview}
                onEditDeck={(d) => setEditingDeck(d)}
                onDeleteDeck={(id) => {
                  setWriteError(null);
                  setDeletionSummary(null);
                  setConfirmCards(false);
                  setDeckToDelete(id);
                }}
              />
            );
          })}
        </div>
      )}

      {/* Create Deck Dialog */}
      {showCreateForm && (
        <DeckForm
          title={t('deck.form.create_new', 'Create New Deck')}
          showNoteType
          defaultLanguages={{
            nativeLanguageId: store.profile?.native_language_id ?? null,
            targetLanguageId: store.profile?.target_language_id ?? null,
          }}
          onSubmit={handleCreateDeck}
          error={writeError}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Edit Deck Dialog */}
      {editingDeck && (
        <DeckForm
          title={t('deck.form.edit_title', 'Edit Deck Details')}
          initialData={{
            title: editingDeck.title,
            description: editingDeck.description || '',
          }}
          onSubmit={handleEditDeck}
          error={writeError}
          onCancel={() => setEditingDeck(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deckToDelete && (
        <div
          onClick={() => {
            if (!isDeleting) setDeckToDelete(null);
          }}
          role="alertdialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
        >
          <Card
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-deck-title"
            aria-describedby="delete-deck-description"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm border border-destructive/20 shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <CardHeader>
              <CardTitle
                id="delete-deck-title"
                className="text-lg font-bold text-destructive flex items-center gap-2"
              >
                <Trash2 className="size-5" />
                {confirmCards
                  ? t(
                      isWordDeck
                        ? 'deck.form.delete_title_words'
                        : 'deck.form.delete_title_cards',
                      {
                        count: deletionSummary?.orphanedCardCount || 0,
                      },
                    )
                  : t('deck.form.delete_title_deck', {
                      title: store.decks.find(
                        (deck) => deck.id === deckToDelete,
                      )?.title,
                    })}
              </CardTitle>
              <CardDescription id="delete-deck-description">
                {confirmCards ? (
                  t('deck.form.delete_cannot_undo')
                ) : deletionSummary ? (
                  <>
                    {t(
                      isWordDeck
                        ? 'deck.form.orphaned_words'
                        : 'deck.form.orphaned_cards',
                      {
                        count: deletionSummary.orphanedCardCount,
                      },
                    )}{' '}
                    {deletionSummary.sharedCardCount > 0 && (
                      <>
                        {t(
                          isWordDeck
                            ? 'deck.form.shared_words'
                            : 'deck.form.shared_cards',
                          {
                            count: deletionSummary.sharedCardCount,
                          },
                        )}{' '}
                      </>
                    )}
                    {t('deck.form.keep_cards_note')}
                  </>
                ) : writeError ? (
                  t('deck.form.load_counts_error')
                ) : (
                  t('deck.form.counting_cards')
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <FormErrorMessage message={writeError} className="mb-4" />
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (confirmCards) {
                      setConfirmCards(false);
                      setWriteError(null);
                    } else setDeckToDelete(null);
                  }}
                  disabled={isDeleting}
                  className="cursor-pointer"
                >
                  {confirmCards ? t('deck.form.back') : t('deck.form.cancel')}
                </Button>
                {!confirmCards && (
                  <Button
                    variant="outline"
                    disabled={isDeleting}
                    onClick={() => void handleDeleteDeck(false)}
                    className="cursor-pointer"
                  >
                    {t('deck.form.delete_deck_only')}
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirmCards) void handleDeleteDeck(true);
                    else setConfirmCards(true);
                  }}
                  disabled={isDeleting || !deletionSummary}
                  className="cursor-pointer"
                >
                  {confirmCards
                    ? t('deck.form.delete_confirm')
                    : deletionSummary
                      ? t(
                          isWordDeck
                            ? 'deck.form.delete_deck_and_words'
                            : 'deck.form.delete_deck_and_cards',
                          {
                            count: deletionSummary.orphanedCardCount,
                          },
                        )
                      : t(
                          isWordDeck
                            ? 'deck.form.delete_deck_and_words_fallback'
                            : 'deck.form.delete_deck_and_cards_fallback',
                        )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
