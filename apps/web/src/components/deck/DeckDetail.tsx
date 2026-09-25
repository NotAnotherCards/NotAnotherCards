import { useMemo, useState, useRef } from 'react';
import { useStore, Card } from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import {
  Card as UICard,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  AlertCircle,
  ArrowLeft,
  HelpCircle,
  Loader2,
  Plus,
  RefreshCw,
  Unlink,
} from 'lucide-react';
import { CardForm } from './CardForm';
import { WordNoteForm, type WordFormValues } from './WordNoteForm';
import {
  BASIC_NOTE_TYPE,
  type UserNoteRecord,
  WORD_NOTE_TYPE,
  WORD_NOTE_FIELDS_VERSION,
} from '@repo/offline-db';
import { deckKind, deckKindClassName, deckKindShort } from './deck-kind';
import { CardList } from './CardList';
import { WordNoteList } from './WordNoteList';
import { WordNoteView } from './WordNoteView';
import {
  parseWordFields,
  preservedWordMedia,
  type RecoverableWordFields,
} from './word-note-fields';
import { toWordRow } from './word-note-rows';
import { writeErrorMessage } from '@/lib/write-error';
import { FormErrorMessage } from '@/components/auth/form-error-message';
import { usePublishing } from '@/hooks/usePublishing';
import { useSyncController } from '@/offline/syncProvider';
import { useOwnerModerationStatus } from '@/hooks/useOwnerModerationStatus';
import {
  type ExplainableFinding,
  useModerationExplanation,
} from '@/hooks/useModerationExplanation';

interface DeckDetailProps {
  deckId: string;
  onBack: () => void;
}

export function DeckDetail({ deckId, onBack }: DeckDetailProps) {
  const store = useStore();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editingWordNote, setEditingWordNote] = useState<UserNoteRecord | null>(
    null,
  );
  const [repairInitialData, setRepairInitialData] =
    useState<RecoverableWordFields | null>(null);
  const [viewingWordNote, setViewingWordNote] = useState<UserNoteRecord | null>(
    null,
  );
  const [noteIdToRemove, setNoteIdToRemove] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [isPendingPublishAction, setIsPendingPublishAction] = useState(false);
  const isBusyRef = useRef(false);
  const {
    publish,
    unpublish,
    isPublishing,
    isUnpublishing,
    error,
    setError,
    warnings: publishWarnings,
  } = usePublishing();
  const controller = useSyncController();
  const { status: moderationStatus, refresh: refreshModerationStatus } =
    useOwnerModerationStatus(deckId);
  const explanation = useModerationExplanation(deckId);
  const deck = store.decks.find((d) => d.id === deckId);
  const isBasicDeck = deck?.note_type === BASIC_NOTE_TYPE;
  const isWordDeck = deck?.note_type === WORD_NOTE_TYPE;
  const isKnownDeck = isBasicDeck || isWordDeck;
  const cards = useMemo(
    () => store.getCardsForDeck(deckId),
    [deckId, store.getCardsForDeck],
  );
  const wordNotes = useMemo(
    () => (isWordDeck ? store.getNotesForDeck(deckId) : []),
    [deckId, isWordDeck, store.getNotesForDeck],
  );

  if (store.isTakenOver) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="cursor-pointer gap-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Decks
        </Button>
        <UICard className="border border-amber-500/30 bg-amber-500/10 p-8 flex flex-col items-center justify-center text-center space-y-4">
          <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
            <AlertCircle className="size-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-amber-900 dark:text-amber-200">
              Database Inactive (Taken Over)
            </h3>
            <p className="text-sm text-amber-800/80 dark:text-amber-300/80 mt-1 max-w-md">
              This tab is currently inactive because the offline database is
              open in another tab. Click below to use the database in this
              window.
            </p>
          </div>
          <Button
            onClick={() => window.location.reload()}
            className="cursor-pointer gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-medium border-none shadow-sm"
          >
            <RefreshCw className="size-4" />
            Use here instead
          </Button>
        </UICard>
      </div>
    );
  }

  if (!store.ready) {
    if (store.showSpinner) {
      return (
        <div className="flex flex-col items-center justify-center min-h-80 space-y-4 animate-in fade-in duration-300">
          <Loader2 className="animate-spin size-8 text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">
            Loading deck details...
          </p>
        </div>
      );
    }
    return null;
  }

  const isPublic =
    deck?.visibility === 'public' && moderationStatus.status !== 'blocked';
  // The note's own fields, parsed from the note rather than read off the
  // card, whose front and back are a template's output.
  const editingWordFields =
    editingWordNote && isWordDeck ? parseWordFields(editingWordNote) : null;

  if (!deck) {
    return (
      <div className="text-center p-8">
        <p className="text-destructive font-semibold">Deck not found.</p>
        <Button onClick={onBack} className="mt-4 cursor-pointer">
          <ArrowLeft className="size-4 mr-2" /> Back to Decks
        </Button>
      </div>
    );
  }

  const viewingWordCards =
    viewingWordNote === null
      ? []
      : cards.filter((card) => card.note_id === viewingWordNote.id);
  const viewingWordRow =
    viewingWordNote && isWordDeck
      ? toWordRow(viewingWordNote, viewingWordCards)
      : null;
  const visibleWarnings =
    publishWarnings.length > 0
      ? publishWarnings
      : moderationStatus.status === 'visible'
        ? moderationStatus.warnings
        : [];

  const findingList = (
    findings: ExplainableFinding[],
    title?: string,
    source: 'working' | 'published' = 'published',
  ) => (
    <div className="space-y-2">
      {title && <p className="text-sm font-semibold">{title}</p>}
      <ul className="space-y-2 text-sm">
        {findings.map((finding, index) => {
          const key = `${finding.cardId}:${finding.reason}`;
          const isActive = explanation.activeKey === `${source}:${key}`;
          return (
            <li
              key={`${key}:${index}`}
              className="rounded-lg border border-border/60 bg-background/60 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-muted-foreground">
                  {finding.cardId.slice(0, 8)}
                </span>
                <span className="grow text-foreground">{finding.reason}</span>
                {finding.classifier && (
                  <span className="text-xs text-muted-foreground">
                    {finding.classifier}
                  </span>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 cursor-pointer gap-1"
                  onClick={() => void explanation.explain(finding, source)}
                  disabled={isActive && explanation.isLoading}
                >
                  {isActive && explanation.isLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <HelpCircle className="size-3.5" />
                  )}
                  Why?
                </Button>
              </div>
              {isActive && (explanation.text || explanation.error) && (
                <p
                  className={`mt-2 border-t border-border/50 pt-2 ${
                    explanation.error
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  }`}
                  aria-live="polite"
                >
                  {explanation.error ?? explanation.text}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );

  const classifierResultList = () => {
    if (moderationStatus.status !== 'blocked') return null;
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold">Classifier results</p>
        <ul className="space-y-2 text-sm">
          {moderationStatus.results.map((result, index) => {
            const reason = result.categories?.length
              ? result.categories.join(', ')
              : result.verdict[0].toUpperCase() + result.verdict.slice(1);
            const finding = {
              cardId: result.cardId,
              reason,
              classifier: result.classifier,
            };
            const key = `${result.cardId}:${reason}`;
            const isActive = explanation.activeKey === `published:${key}`;
            const canExplain =
              result.verdict === 'unsafe' || result.verdict === 'controversial';
            return (
              <li
                key={`${result.classifier}:${result.cardId}:${index}`}
                className="rounded-lg border border-border/60 bg-background/60 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-muted-foreground">
                    {result.cardId.slice(0, 8)}
                  </span>
                  <span className="font-semibold capitalize">
                    {result.verdict}
                  </span>
                  <span className="grow text-foreground">
                    {result.categories === null
                      ? 'No category supplied'
                      : result.categories.length > 0
                        ? result.categories.join(', ')
                        : 'Categories: none'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {result.classifier}
                  </span>
                  {canExplain && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 cursor-pointer gap-1"
                      onClick={() =>
                        void explanation.explain(finding, 'published')
                      }
                      disabled={isActive && explanation.isLoading}
                    >
                      {isActive && explanation.isLoading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <HelpCircle className="size-3.5" />
                      )}
                      Why?
                    </Button>
                  )}
                </div>
                {result.error && (
                  <p className="mt-2 text-xs text-destructive">
                    Check failed: {result.error}
                  </p>
                )}
                {isActive && (explanation.text || explanation.error) && (
                  <p
                    className={`mt-2 border-t border-border/50 pt-2 ${
                      explanation.error
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    }`}
                    aria-live="polite"
                  >
                    {explanation.error ?? explanation.text}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  // the dialog is dismissed only once the write lands, so a failed write is
  // never reported to the user as a success
  const handleCreateCard = async (data: { front: string; back: string }) => {
    setWriteError(null);
    try {
      await store.createCard(deckId, data.front, data.back);
      setShowCreateForm(false);
    } catch (err) {
      setWriteError(writeErrorMessage(err, 'Failed to create card'));
    }
  };

  const handleCreateWordNote = async (values: WordFormValues) => {
    if (!deck) return;
    setWriteError(null);
    try {
      // The deck owns the language pair; the form never asks for it.
      await store.createNote(deckId, WORD_NOTE_TYPE, WORD_NOTE_FIELDS_VERSION, {
        ...values,
        native_language_id: deck.native_language_id,
        target_language_id: deck.target_language_id,
      });
      setShowCreateForm(false);
    } catch (err) {
      setWriteError(writeErrorMessage(err, 'Failed to create card'));
    }
  };

  const handleEditWordNote = async (values: WordFormValues) => {
    if (!editingWordNote) return;
    const nativeLanguageId =
      editingWordFields?.native_language_id ?? deck.native_language_id;
    const targetLanguageId =
      editingWordFields?.target_language_id ?? deck.target_language_id;
    if (!nativeLanguageId || !targetLanguageId) return;
    const media = editingWordFields ?? preservedWordMedia(editingWordNote);
    setWriteError(null);
    try {
      await store.updateNoteFields(editingWordNote.id, {
        ...values,
        native_language_id: nativeLanguageId,
        target_language_id: targetLanguageId,
        ...(media.image ? { image: media.image } : {}),
        ...(media.word_audio ? { word_audio: media.word_audio } : {}),
      });
      setEditingWordNote(null);
      setRepairInitialData(null);
    } catch (err) {
      setWriteError(writeErrorMessage(err, 'Failed to update word'));
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

  const handleRemoveFromDeck = async () => {
    if (!noteIdToRemove) return;
    setIsRemoving(true);
    setWriteError(null);
    try {
      await store.removeNoteFromDeck(noteIdToRemove, deckId);
      setNoteIdToRemove(null);
    } catch (err) {
      setWriteError(writeErrorMessage(err, 'Failed to remove note from deck'));
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Detail Header & Action Buttons */}
      <div className="flex flex-col gap-4 bg-muted/20 p-5 rounded-3xl border border-border/40">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="cursor-pointer gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Decks
          </Button>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`${deckKindClassName} inline-flex h-6 shrink-0 items-center whitespace-nowrap font-medium leading-none`}
                data-testid="deck-kind"
                title={deckKind(deck)}
                aria-label={deckKind(deck)}
              >
                {deckKindShort(deck)}
              </span>
              <h2 className="truncate text-2xl font-bold text-foreground font-heading">
                {deck.title}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              {deck.description || 'Manage your library cards below.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 self-stretch md:self-auto">
            {isPublic ? (
              <Button
                variant="outline"
                disabled={isUnpublishing || isPendingPublishAction}
                onClick={async () => {
                  if (isBusyRef.current) return;
                  isBusyRef.current = true;
                  setIsPendingPublishAction(true);
                  try {
                    await controller?.syncNow();
                    await unpublish(
                      deckId,
                      () => controller?.syncNow() || Promise.resolve(),
                    );
                  } finally {
                    setIsPendingPublishAction(false);
                    isBusyRef.current = false;
                  }
                }}
                className="cursor-pointer gap-1.5 justify-center"
              >
                Unpublish
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled={isPublishing || isPendingPublishAction}
                onClick={async () => {
                  if (isBusyRef.current) return;
                  isBusyRef.current = true;
                  setIsPendingPublishAction(true);
                  try {
                    await controller?.syncNow();
                    const published = await publish(
                      deckId,
                      () => controller?.syncNow() || Promise.resolve(),
                    );
                    if (published) await refreshModerationStatus();
                  } finally {
                    setIsPendingPublishAction(false);
                    isBusyRef.current = false;
                  }
                }}
                className="cursor-pointer gap-1.5 justify-center"
              >
                Publish
              </Button>
            )}
            {isKnownDeck && (
              <Button
                onClick={() => setShowCreateForm(true)}
                className="cursor-pointer gap-1.5 justify-center"
              >
                <Plus className="size-4" />
                Add Card
              </Button>
            )}
          </div>
        </div>
        {!isKnownDeck && (
          <p className="text-sm text-muted-foreground">
            This deck uses a note type this app cannot edit yet.
          </p>
        )}
      </div>

      {visibleWarnings.length > 0 && (
        <UICard role="status" className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <AlertCircle className="size-5" />
              Published with moderation warnings
            </CardTitle>
            <CardDescription>
              Your deck is public, but these cards may cover sensitive or
              controversial material. You can review the reason without
              unpublishing it.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {findingList(visibleWarnings, 'Warnings')}
          </CardContent>
        </UICard>
      )}

      {moderationStatus.status === 'blocked' && (
        <UICard role="alert" className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-destructive">
              <AlertCircle className="size-5" />
              Deck taken down
            </CardTitle>
            <CardDescription>
              This deck is no longer visible to the community. Review the
              moderation result, edit the working copy, and publish again when
              it is ready.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <FormErrorMessage
              message={
                moderationStatus.reason ??
                'The reported deck did not pass moderation.'
              }
            />
            {moderationStatus.results.length > 0 ? (
              classifierResultList()
            ) : (
              <>
                {moderationStatus.flagged.length > 0 &&
                  findingList(moderationStatus.flagged, 'Flagged cards')}
                {moderationStatus.warnings.length > 0 &&
                  findingList(moderationStatus.warnings, 'Warnings')}
              </>
            )}
          </CardContent>
        </UICard>
      )}

      {/* Library View (Search & Card Table via CardList) */}
      {isWordDeck ? (
        <WordNoteList
          notes={wordNotes}
          cards={cards}
          dueCards={store.dueCards ?? []}
          onViewNote={(note) => setViewingWordNote(note)}
          onEditWord={(note) => {
            setRepairInitialData(null);
            setEditingWordNote(note);
          }}
          onRepairWord={(note, initialData) => {
            setRepairInitialData(initialData);
            setEditingWordNote(note);
          }}
          onRemoveWord={(note) => setNoteIdToRemove(note.id)}
          canEdit={isKnownDeck}
          canRemove={isKnownDeck}
          onAddWord={() => setShowCreateForm(true)}
        />
      ) : (
        <CardList
          cards={cards}
          onEditCard={(card) => setEditingCard(card)}
          onRemoveFromDeck={(card) => setNoteIdToRemove(card.note_id)}
          canEditCard={isBasicDeck ? store.isBasicCard : () => false}
          canAddCard={isKnownDeck}
          canRemoveCard={isKnownDeck}
          onAddCard={() => setShowCreateForm(true)}
          isLoading={!store.ready}
        />
      )}

      {/* Add: the deck's note type decides which form appears */}
      {showCreateForm &&
        (isWordDeck ? (
          <WordNoteForm
            key={deckId}
            title="Add New Word"
            generationDeck={
              deck.native_language_id && deck.target_language_id
                ? {
                    deckId,
                    nativeLanguageId: deck.native_language_id,
                    targetLanguageId: deck.target_language_id,
                  }
                : undefined
            }
            targetLanguageId={deck.target_language_id}
            nativeLanguageId={deck.native_language_id}
            onSubmit={handleCreateWordNote}
            error={writeError}
            onCancel={() => setShowCreateForm(false)}
          />
        ) : isBasicDeck ? (
          <CardForm
            title="Add New Card"
            onSubmit={handleCreateCard}
            error={writeError}
            onCancel={() => setShowCreateForm(false)}
          />
        ) : null)}

      {/* Edit: a word note is edited through its own fields, not through
          the front and back a template rendered from them */}
      {editingWordNote && isWordDeck ? (
        <WordNoteForm
          title={repairInitialData ? 'Repair word' : 'Edit Word'}
          alwaysShowDetails
          targetLanguageId={
            editingWordFields?.target_language_id ?? deck.target_language_id
          }
          nativeLanguageId={
            editingWordFields?.native_language_id ?? deck.native_language_id
          }
          initialData={editingWordFields ?? repairInitialData ?? undefined}
          onSubmit={handleEditWordNote}
          error={writeError}
          onCancel={() => {
            setRepairInitialData(null);
            setEditingWordNote(null);
          }}
          onRemove={
            repairInitialData
              ? () => {
                  setRepairInitialData(null);
                  setEditingWordNote(null);
                  setNoteIdToRemove(editingWordNote.id);
                }
              : undefined
          }
        />
      ) : editingCard && isBasicDeck ? (
        <CardForm
          title="Edit Card"
          initialData={{
            front: editingCard.front,
            back: editingCard.back,
          }}
          onSubmit={handleEditCard}
          error={writeError}
          onCancel={() => setEditingCard(null)}
        />
      ) : null}

      {viewingWordNote && viewingWordRow && (
        <WordNoteView
          fields={viewingWordRow.fields}
          cards={viewingWordRow.badges}
          onClose={() => setViewingWordNote(null)}
          onEdit={() => {
            setViewingWordNote(null);
            setRepairInitialData(null);
            setEditingWordNote(viewingWordNote);
          }}
        />
      )}

      {/* Remove deck membership confirmation */}
      {noteIdToRemove && (
        <div
          onClick={() => setNoteIdToRemove(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
        >
          <UICard
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm border border-destructive/20 shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <CardHeader>
              <CardTitle className="text-lg font-bold text-destructive flex items-center gap-2">
                <Unlink className="size-5" />
                {isWordDeck
                  ? 'Remove Word from Deck?'
                  : 'Remove Note from Deck?'}
              </CardTitle>
              <CardDescription>
                {isWordDeck ? (
                  <>
                    This removes every study card generated from this word from
                    “{deck.title}”. The word, its cards, schedule, and review
                    history will remain in your personal dictionary.
                  </>
                ) : (
                  <>
                    This removes every study card generated from this note from
                    “{deck.title}”. The note, its cards, schedule, and review
                    history will remain in your personal dictionary.
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <FormErrorMessage message={writeError} className="mb-4" />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setNoteIdToRemove(null)}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleRemoveFromDeck}
                  disabled={isRemoving}
                  className="cursor-pointer"
                >
                  Remove from Deck
                </Button>
              </div>
            </CardContent>
          </UICard>
        </div>
      )}
      {/* Moderation Error Feedback */}
      {error && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="moderation-error-title"
          onClick={() => setError(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
        >
          <UICard
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <CardHeader>
              <CardTitle
                id="moderation-error-title"
                className="text-lg font-bold flex items-center gap-2"
              >
                <AlertCircle className="size-5 text-destructive" />
                {error.action === 'publish'
                  ? 'Could Not Publish Deck'
                  : 'Could Not Unpublish Deck'}
              </CardTitle>
              <CardDescription>
                {error.flagged && error.flagged.length > 0
                  ? 'The deck was refused by our automated moderation system. Please review the flagged content before trying again.'
                  : 'There was an issue processing your request. Please try again.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <FormErrorMessage message={error.reason} />

              {error.flagged && error.flagged.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-4 border border-border text-sm max-h-48 overflow-y-auto">
                  {findingList(error.flagged, 'Flagged cards', 'working')}
                </div>
              )}
              <div className="flex justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => setError(null)}
                  className="cursor-pointer"
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </UICard>
        </div>
      )}
    </div>
  );
}
