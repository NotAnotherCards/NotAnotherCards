import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AiCardOutput } from '@repo/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  ArrowRight,
  BookOpen,
  FolderPlus,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';

interface Deck {
  id: string;
  title: string;
}

interface AiResultPreviewProps {
  cards: AiCardOutput[];
  decks: Deck[];
  onSave: (deckIdOrTitle: string, isNew: boolean) => Promise<void>;
  isSaving: boolean;
}

export function AiResultPreview({
  cards,
  decks,
  onSave,
  isSaving,
}: AiResultPreviewProps) {
  const { t } = useTranslation();
  const [deckMode, setDeckMode] = useState<'existing' | 'new'>('existing');
  const [selectedDeckId, setSelectedDeckId] = useState(decks[0]?.id || '');
  const [newDeckTitle, setNewDeckTitle] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedDeckId && decks.length > 0) {
      setSelectedDeckId(decks[0].id);
    }
  }, [decks, selectedDeckId]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (savedSuccess) {
      timeout = setTimeout(() => setSavedSuccess(false), 3000);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [savedSuccess]);

  const handleSave = async () => {
    setSaveError(null);
    try {
      if (deckMode === 'existing') {
        if (!selectedDeckId) return;
        await onSave(selectedDeckId, false);
      } else {
        if (!newDeckTitle.trim()) return;
        await onSave(newDeckTitle.trim(), true);
      }
      setSavedSuccess(true);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : t('playground.preview.save_cards_failed', 'Failed to save cards');
      setSaveError(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            {t('playground.preview.results_title', 'Creation Results')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(
              'playground.preview.results_desc',
              'Created {{count}} structured flashcard note candidates.',
              { count: cards.length },
            )}
          </p>
        </div>
      </div>

      <div className="space-y-4 max-h-100 overflow-y-auto pr-2">
        {cards.map((card, idx) => (
          <div
            key={idx}
            className="bg-card/40 border border-border/60 rounded-2xl p-4 shadow-sm hover:border-violet-500/30 transition-all duration-200 group flex flex-col md:flex-row gap-4 justify-between items-stretch"
          >
            <div className="flex-1 space-y-1">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t('playground.preview.front', 'Front')}
              </div>
              <div className="text-sm font-medium">
                <MarkdownRenderer content={card.front} />
              </div>
            </div>
            <div className="hidden md:flex items-center text-muted-foreground">
              <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t('playground.preview.back', 'Back')}
              </div>
              <div className="text-sm font-medium">
                <MarkdownRenderer content={card.back} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Persistence Section */}
      <div className="bg-card/30 border border-border/50 rounded-3xl p-6 backdrop-blur-sm space-y-6">
        <div>
          <h3 className="text-lg font-bold tracking-tight">
            {t('playground.preview.save_db', 'Save to Database')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t(
              'playground.preview.save_db_desc',
              'Choose deck membership. Saving creates flashcards in your selected deck.',
            )}
          </p>
        </div>

        {saveError && (
          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-2xl p-3 text-xs text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {/* Deck Mode Toggle */}
        <div className="flex bg-muted/40 p-1 rounded-xl w-fit border border-border/40">
          <button
            type="button"
            onClick={() => setDeckMode('existing')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
              deckMode === 'existing'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground'
            }`}
          >
            <BookOpen className="size-3.5" />{' '}
            {t('playground.preview.select_deck', 'Select Deck')}
          </button>
          <button
            type="button"
            onClick={() => setDeckMode('new')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
              deckMode === 'new'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground'
            }`}
          >
            <FolderPlus className="size-3.5" />{' '}
            {t('playground.preview.create_new', 'Create New')}
          </button>
        </div>

        {/* Target Deck input */}
        {deckMode === 'existing' ? (
          <Field className="space-y-2">
            <FieldLabel htmlFor="deck-select">
              {t('playground.form.target_deck', 'Target Deck')}
            </FieldLabel>
            <div className="relative">
              <select
                id="deck-select"
                value={selectedDeckId}
                onChange={(e) => setSelectedDeckId(e.target.value)}
                className="w-full rounded-3xl border border-border/60 bg-input/50 px-3 py-2 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 outline-none appearance-none cursor-pointer"
              >
                <option value="" disabled>
                  {t('playground.preview.choose_deck', '-- Choose a deck --')}
                </option>
                {decks.map((deck) => (
                  <option
                    key={deck.id}
                    value={deck.id}
                    className="bg-background text-foreground"
                  >
                    {deck.title}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                ▼
              </div>
            </div>
          </Field>
        ) : (
          <Field className="space-y-2">
            <FieldLabel htmlFor="new-deck">
              {t('playground.preview.new_deck_name', 'New Deck Name')}
            </FieldLabel>
            <Input
              id="new-deck"
              placeholder={t(
                'playground.preview.new_deck_placeholder',
                'e.g. French Vocab A1',
              )}
              value={newDeckTitle}
              onChange={(e) => setNewDeckTitle(e.target.value)}
              className="w-full border-border/60"
            />
          </Field>
        )}

        <Button
          onClick={handleSave}
          disabled={
            isSaving ||
            (deckMode === 'existing' && !selectedDeckId) ||
            (deckMode === 'new' && !newDeckTitle.trim())
          }
          className="w-full bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-3xl py-5 shadow-lg shadow-emerald-500/10 font-semibold cursor-pointer"
        >
          {isSaving
            ? t('playground.preview.saving_cards', 'Saving to Deck...')
            : t('playground.preview.save_cards', 'Save Cards to Deck')}
        </Button>
      </div>

      {/* Toast Notification */}
      {savedSuccess && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl border border-emerald-500/30 transition-all duration-300">
          <CheckCircle2 className="size-5 shrink-0 text-white" />
          <div>
            <h4 className="font-semibold text-sm">
              {t('playground.preview.deck_saved', 'Deck Saved!')}
            </h4>
            <p className="text-xs text-emerald-100">
              {t(
                'playground.preview.deck_saved_desc',
                'Cards have been added to your local library.',
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
