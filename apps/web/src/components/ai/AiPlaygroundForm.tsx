import React, { useState, useEffect } from 'react';
import {
  CreateAiJobInput,
  AiModel,
  MODEL_LABELS,
  SELECTABLE_AI_MODELS,
  QuotaStatus,
  LANGUAGES,
  languageFor,
} from '@repo/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
} from '@/components/ui/field';
import {
  Sparkles,
  Layers,
  Type,
  BookOpen,
  FolderPlus,
  ArrowRightLeft,
} from 'lucide-react';
import type { DeckNoteType } from '@repo/offline-db';

interface Deck {
  id: string;
  title: string;
  note_type: string;
}

interface AiPlaygroundFormProps {
  quota: QuotaStatus | null;
  onSubmit: (data: CreateAiJobInput) => void;
  isSubmitting: boolean;
  decks: Deck[];
  createDeck: (
    title: string,
    description: string,
    options?: {
      noteType?: DeckNoteType;
      nativeLanguageId?: string | null;
      targetLanguageId?: string | null;
    },
  ) => Promise<{ id: string }>;
}

export function AiPlaygroundForm({
  quota,
  onSubmit,
  isSubmitting,
  decks,
  createDeck,
}: AiPlaygroundFormProps) {
  const [mode, setMode] = useState<'topic_deck' | 'text_cards' | 'word_note'>(
    'topic_deck',
  );

  // Topic / Text Fields
  const [topic, setTopic] = useState('');
  const [sourceText, setSourceText] = useState('');

  // Word Note Fields
  const [word, setWord] = useState('');
  const [direction, setDirection] = useState<'target' | 'native'>('target');

  // Deck Selection for Word Note
  const [deckMode, setDeckMode] = useState<'existing' | 'new'>('existing');
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [newDeckTitle, setNewDeckTitle] = useState('');
  const [nativeLanguageId, setNativeLanguageId] = useState<string>(
    LANGUAGES[0].value,
  );
  const [targetLanguageId, setTargetLanguageId] = useState<string>(
    LANGUAGES[1].value,
  );

  const [count, setCount] = useState(5);
  const [model, setModel] = useState<AiModel>('gemma4');
  const [error, setError] = useState<string | null>(null);

  const wordDecks = decks.filter((d) => d.note_type === 'word');

  const effectiveDeckMode = wordDecks.length === 0 ? 'new' : deckMode;

  useEffect(() => {
    if (
      mode === 'word_note' &&
      effectiveDeckMode === 'existing' &&
      wordDecks.length > 0 &&
      !selectedDeckId
    ) {
      setSelectedDeckId(wordDecks[0].id);
    }
  }, [mode, wordDecks, selectedDeckId, effectiveDeckMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (mode === 'topic_deck') {
        if (!topic.trim()) return setError('Subject/Topic cannot be empty');
        onSubmit({ type: 'topic_deck', topic: topic.trim(), count, model });
      } else if (mode === 'text_cards') {
        if (!sourceText.trim()) return setError('Source text cannot be empty');
        onSubmit({
          type: 'text_cards',
          sourceText: sourceText.trim(),
          count,
          model,
        });
      } else if (mode === 'word_note') {
        if (!word.trim()) return setError('Word cannot be empty');

        let deckId = selectedDeckId;

        if (effectiveDeckMode === 'new') {
          if (!newDeckTitle.trim())
            return setError('Deck Name cannot be empty');
          const newDeck = await createDeck(
            newDeckTitle.trim(),
            'Created Word Deck',
            {
              noteType: 'word' as DeckNoteType,
              nativeLanguageId,
              targetLanguageId,
            },
          );
          deckId = newDeck.id;
          // After creating, we might want to switch back to existing to keep it selected
          // but we are about to submit, so it's fine.
        } else {
          if (!deckId) return setError('Please select or create a target deck');
        }

        const nativeLang = languageFor(nativeLanguageId);
        const targetLang = languageFor(targetLanguageId);

        if (!nativeLang || !targetLang)
          return setError('Invalid languages selected');

        onSubmit({
          type: 'word_note',
          deckId,
          word: word.trim(),
          direction,
          model,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const usedCount = quota?.requestsUsed ?? 0;
  const limitCount = quota?.maxRequests ?? 0;
  const quotaPercent =
    limitCount > 0 ? Math.min((usedCount / limitCount) * 100, 100) : 0;
  const isQuotaExceeded = limitCount > 0 ? usedCount >= limitCount : false;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Quota Indicator */}
      <div className="bg-card/40 border border-border/50 rounded-2xl p-4 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="size-4 text-amber-500 animate-pulse" />
            Quota Status
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {quota
              ? `${usedCount}/${limitCount} requests used`
              : 'Loading quota...'}
          </span>
        </div>
        <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              isQuotaExceeded
                ? 'bg-destructive'
                : 'bg-linear-to-r from-violet-500 to-indigo-500'
            }`}
            style={{ width: `${quota ? quotaPercent : 0}%` }}
          />
        </div>
      </div>

      {/* Mode Selector */}
      <div className="flex bg-muted/40 p-1 rounded-xl border border-border/40">
        <button
          type="button"
          onClick={() => setMode('topic_deck')}
          className={`flex-1 flex justify-center items-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
            mode === 'topic_deck'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground/80'
          }`}
        >
          <Layers className="size-3.5" /> Topic Deck
        </button>
        <button
          type="button"
          onClick={() => setMode('text_cards')}
          className={`flex-1 flex justify-center items-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
            mode === 'text_cards'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground/80'
          }`}
        >
          <Type className="size-3.5" /> Text Cards
        </button>
        <button
          type="button"
          onClick={() => setMode('word_note')}
          className={`flex-1 flex justify-center items-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
            mode === 'word_note'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground/80'
          }`}
        >
          <BookOpen className="size-3.5" /> Word Note
        </button>
      </div>

      {/* Input Fields based on mode */}
      {mode === 'topic_deck' && (
        <Field className="space-y-2">
          <FieldLabel htmlFor="topic">Subject / Topic</FieldLabel>
          <FieldDescription>
            Describe what you want to learn (e.g. "Spanish Nouns").
          </FieldDescription>
          <Input
            id="topic"
            placeholder="e.g. Spanish Subjunctive"
            value={topic}
            onChange={(e) => setTopic(e.target.value.slice(0, 300))}
            maxLength={300}
            className="w-full border-border/60 focus-visible:ring-violet-500/20"
          />
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Limit 300 chars</span>
            <span>{topic.length}/300</span>
          </div>
        </Field>
      )}

      {mode === 'text_cards' && (
        <Field className="space-y-2">
          <FieldLabel htmlFor="sourceText">Source Text</FieldLabel>
          <FieldDescription>
            Paste an article or notes to create cards from.
          </FieldDescription>
          <textarea
            id="sourceText"
            placeholder="Paste text here..."
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value.slice(0, 10000))}
            maxLength={10000}
            className="w-full min-h-30 rounded-2xl border border-border/60 bg-input/50 px-4 py-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 outline-none resize-y"
          />
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Limit 10000 chars</span>
            <span>{sourceText.length}/10000</span>
          </div>
        </Field>
      )}

      {mode === 'word_note' && (
        <div className="space-y-6">
          <div className="bg-muted/20 border border-border/40 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <FieldLabel>Target Deck</FieldLabel>
              <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/40 text-[10px]">
                <button
                  type="button"
                  disabled={wordDecks.length === 0}
                  onClick={() => setDeckMode('existing')}
                  className={`flex items-center gap-1 py-1 px-2 rounded-md font-medium transition-all ${
                    effectiveDeckMode === 'existing'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground/80'
                  } ${wordDecks.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Select Existing
                </button>
                <button
                  type="button"
                  onClick={() => setDeckMode('new')}
                  className={`flex items-center gap-1 py-1 px-2 rounded-md font-medium transition-all ${
                    effectiveDeckMode === 'new'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground/80'
                  }`}
                >
                  <FolderPlus className="size-3" /> Create New
                </button>
              </div>
            </div>

            {effectiveDeckMode === 'existing' ? (
              wordDecks.length > 0 ? (
                <div className="relative">
                  <select
                    value={selectedDeckId}
                    onChange={(e) => setSelectedDeckId(e.target.value)}
                    className="w-full rounded-2xl border border-border/60 bg-input/50 px-3 py-2.5 text-sm focus-visible:ring-3 outline-none appearance-none cursor-pointer"
                  >
                    <option value="" disabled>
                      -- Choose a Word Deck --
                    </option>
                    {wordDecks.map((d) => (
                      <option
                        key={d.id}
                        value={d.id}
                        className="bg-background text-foreground"
                      >
                        {d.title}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                    ▼
                  </div>
                </div>
              ) : (
                <div className="text-sm text-amber-500 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                  No word decks available. Please create a new one.
                </div>
              )
            ) : (
              <div className="space-y-4 pt-2 border-t border-border/40">
                <Field className="space-y-2">
                  <FieldLabel htmlFor="new-deck-title">Deck Title</FieldLabel>
                  <Input
                    id="new-deck-title"
                    placeholder="e.g. French Vocabulary"
                    value={newDeckTitle}
                    onChange={(e) => setNewDeckTitle(e.target.value)}
                    className="w-full border-border/60"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field className="space-y-2">
                    <FieldLabel>Native Language</FieldLabel>
                    <div className="relative">
                      <select
                        value={nativeLanguageId}
                        onChange={(e) => setNativeLanguageId(e.target.value)}
                        className="w-full rounded-2xl border border-border/60 bg-input/50 px-3 py-2 text-sm appearance-none cursor-pointer"
                      >
                        {LANGUAGES.map((l) => (
                          <option
                            key={l.value}
                            value={l.value}
                            className="bg-background"
                          >
                            {l.flag} {l.name}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                        ▼
                      </div>
                    </div>
                  </Field>
                  <Field className="space-y-2">
                    <FieldLabel>Target Language</FieldLabel>
                    <div className="relative">
                      <select
                        value={targetLanguageId}
                        onChange={(e) => setTargetLanguageId(e.target.value)}
                        className="w-full rounded-2xl border border-border/60 bg-input/50 px-3 py-2 text-sm appearance-none cursor-pointer"
                      >
                        {LANGUAGES.map((l) => (
                          <option
                            key={l.value}
                            value={l.value}
                            className="bg-background"
                          >
                            {l.flag} {l.name}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                        ▼
                      </div>
                    </div>
                  </Field>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-4 items-end">
            <Field className="space-y-2 flex-1">
              <FieldLabel htmlFor="word">Word / Translation</FieldLabel>
              <Input
                id="word"
                placeholder="e.g. hello, bonjour"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                className="w-full border-border/60"
              />
            </Field>

            <button
              type="button"
              onClick={() =>
                setDirection((d) => (d === 'target' ? 'native' : 'target'))
              }
              className="flex items-center gap-2 h-10 px-4 rounded-xl border border-border/60 bg-muted/40 hover:bg-muted/80 transition-colors text-sm font-medium shrink-0"
              title="Toggle Translation Direction"
            >
              <ArrowRightLeft className="size-4 text-violet-500" />
              <span className="w-16 text-center">
                {direction === 'target' ? 'Target' : 'Native'}
              </span>
            </button>
          </div>

          <div className="bg-violet-500/5 border border-violet-500/10 rounded-xl px-4 py-2.5">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {direction === 'target' ? (
                <>
                  <strong className="text-foreground font-semibold">
                    Target Mode:
                  </strong>{' '}
                  Enter a word in the language you are learning (e.g. "bonjour")
                  to create its dictionary note.
                </>
              ) : (
                <>
                  <strong className="text-foreground font-semibold">
                    Native Mode:
                  </strong>{' '}
                  Enter a word in your native language (e.g. "hello") to
                  translate it and create a note.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Configuration Sliders & Dropdown */}
      <div
        className={`grid grid-cols-1 ${mode === 'word_note' ? 'md:grid-cols-1' : 'md:grid-cols-2'} gap-4`}
      >
        {/* Model Selector */}
        <Field className="space-y-2">
          <FieldLabel htmlFor="model">Model Selection</FieldLabel>
          <div className="relative">
            <select
              id="model"
              value={model}
              onChange={(e) => {
                const chosen = SELECTABLE_AI_MODELS.find(
                  (m) => m === e.target.value,
                );
                if (chosen) setModel(chosen);
              }}
              className="w-full rounded-3xl border border-border/60 bg-input/50 px-3 py-2 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 outline-none appearance-none cursor-pointer"
            >
              {SELECTABLE_AI_MODELS.map((m) => (
                <option
                  key={m}
                  value={m}
                  className="bg-background text-foreground"
                >
                  {MODEL_LABELS[m]}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
              ▼
            </div>
          </div>
        </Field>

        {/* Card Count Selector (hidden for word_note) */}
        {mode !== 'word_note' && (
          <Field className="space-y-2">
            <div className="flex justify-between items-center">
              <FieldLabel htmlFor="count">Card Count</FieldLabel>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground">
                {count} cards
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="count"
                type="range"
                min="1"
                max="20"
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value))}
                className="w-full accent-violet-600 cursor-pointer h-1.5 bg-muted rounded-lg appearance-none"
              />
            </div>
          </Field>
        )}
      </div>

      {error && <FieldError>{error}</FieldError>}

      <Button
        type="submit"
        disabled={isSubmitting || isQuotaExceeded}
        className="w-full bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-3xl py-5 shadow-lg shadow-indigo-500/10 font-semibold group relative overflow-hidden"
      >
        <span className="flex items-center justify-center gap-2">
          <Sparkles className="size-4 animate-pulse" />
          {isSubmitting ? 'Creating...' : 'Create'}
        </span>
      </Button>
    </form>
  );
}
