import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CreateAiJobInput,
  AiModel,
  MODEL_LABELS,
  SELECTABLE_AI_MODELS,
  QuotaStatus,
} from '@repo/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
} from '@/components/ui/field';
import { Sparkles, Layers, Type, BookOpen, ArrowRightLeft } from 'lucide-react';

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
}

export function AiPlaygroundForm({
  quota,
  onSubmit,
  isSubmitting,
  decks,
}: AiPlaygroundFormProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'topic_deck' | 'text_cards' | 'word_note'>(
    'topic_deck',
  );

  // Topic / Text Fields
  const [topic, setTopic] = useState('');
  const [sourceText, setSourceText] = useState('');

  // Word Note Fields
  const [word, setWord] = useState('');
  const [direction, setDirection] = useState<'target' | 'native'>('target');

  const [selectedDeckId, setSelectedDeckId] = useState('');

  const [count, setCount] = useState(5);
  const [model, setModel] = useState<AiModel>('gemma4');
  const [error, setError] = useState<string | null>(null);

  const wordDecks = decks.filter((d) => d.note_type === 'word');

  useEffect(() => {
    if (mode === 'word_note' && wordDecks.length > 0 && !selectedDeckId) {
      setSelectedDeckId(wordDecks[0].id);
    }
  }, [mode, wordDecks, selectedDeckId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (mode === 'topic_deck') {
        if (!topic.trim())
          return setError(
            t('playground.form.error_topic', 'Subject/Topic cannot be empty'),
          );
        onSubmit({ type: 'topic_deck', topic: topic.trim(), count, model });
      } else if (mode === 'text_cards') {
        if (!sourceText.trim())
          return setError(
            t('playground.form.error_text', 'Source text cannot be empty'),
          );
        onSubmit({
          type: 'text_cards',
          sourceText: sourceText.trim(),
          count,
          model,
        });
      } else if (mode === 'word_note') {
        if (!word.trim())
          return setError(
            t('playground.form.error_word', 'Word cannot be empty'),
          );
        if (!selectedDeckId)
          return setError(
            t('playground.form.error_deck', 'Please select a target deck'),
          );

        onSubmit({
          type: 'word_note',
          deckId: selectedDeckId,
          word: word.trim(),
          direction,
          model,
        });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('playground.form.error_generic', 'An error occurred'),
      );
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
            {t('playground.form.quota_status', 'Quota Status')}
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {quota
              ? t(
                  'playground.form.quota_used',
                  '{{used}}/{{limit}} requests used',
                  { used: usedCount, limit: limitCount },
                )
              : t('playground.form.quota_loading', 'Loading quota...')}
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
          <Layers className="size-3.5" />{' '}
          {t('playground.form.mode_topic', 'Topic Deck')}
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
          <Type className="size-3.5" />{' '}
          {t('playground.form.mode_text', 'Text Cards')}
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
          <BookOpen className="size-3.5" />{' '}
          {t('playground.form.mode_word', 'Word Note')}
        </button>
      </div>

      {/* Input Fields based on mode */}
      {mode === 'topic_deck' && (
        <Field className="space-y-2">
          <FieldLabel htmlFor="topic">
            {t('playground.form.topic_label', 'Subject / Topic')}
          </FieldLabel>
          <FieldDescription>
            {t(
              'playground.form.topic_desc',
              'Describe what you want to learn (e.g. "Spanish Nouns").',
            )}
          </FieldDescription>
          <Input
            id="topic"
            placeholder={t(
              'playground.form.topic_placeholder',
              'e.g. Spanish Subjunctive',
            )}
            value={topic}
            onChange={(e) => setTopic(e.target.value.slice(0, 300))}
            maxLength={300}
            className="w-full border-border/60 focus-visible:ring-violet-500/20"
          />
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>
              {t('playground.form.limit_chars', 'Limit {{count}} chars', {
                count: 300,
              })}
            </span>
            <span>{topic.length}/300</span>
          </div>
        </Field>
      )}

      {mode === 'text_cards' && (
        <Field className="space-y-2">
          <FieldLabel htmlFor="sourceText">
            {t('playground.form.text_label', 'Source Text')}
          </FieldLabel>
          <FieldDescription>
            {t(
              'playground.form.text_desc',
              'Paste an article or notes to create cards from.',
            )}
          </FieldDescription>
          <textarea
            id="sourceText"
            placeholder={t(
              'playground.form.text_placeholder',
              'Paste text here...',
            )}
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value.slice(0, 10000))}
            maxLength={10000}
            className="w-full min-h-30 rounded-2xl border border-border/60 bg-input/50 px-4 py-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 outline-none resize-y"
          />
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>
              {t('playground.form.limit_chars', 'Limit {{count}} chars', {
                count: 10000,
              })}
            </span>
            <span>{sourceText.length}/10000</span>
          </div>
        </Field>
      )}

      {mode === 'word_note' && (
        <div className="space-y-6">
          <div className="bg-muted/20 border border-border/40 rounded-2xl p-4 space-y-4">
            <FieldLabel>
              {t('playground.form.target_deck', 'Target Deck')}
            </FieldLabel>

            {wordDecks.length > 0 ? (
              <div className="relative">
                <select
                  value={selectedDeckId}
                  onChange={(e) => setSelectedDeckId(e.target.value)}
                  className="w-full rounded-2xl border border-border/60 bg-input/50 px-3 py-2.5 text-sm focus-visible:ring-3 outline-none appearance-none cursor-pointer"
                >
                  <option value="" disabled>
                    {t(
                      'playground.form.choose_deck',
                      '-- Choose a Word Deck --',
                    )}
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
                {t(
                  'playground.form.no_word_decks',
                  'No word decks available. Please create one in the Decks tab.',
                )}
              </div>
            )}
          </div>

          <div className="flex gap-4 items-end">
            <Field className="space-y-2 flex-1">
              <FieldLabel htmlFor="word">
                {t('playground.form.word_label', 'Word / Translation')}
              </FieldLabel>
              <Input
                id="word"
                placeholder={t(
                  'playground.form.word_placeholder',
                  'e.g. hello, bonjour',
                )}
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
              title={t(
                'playground.form.toggle_dir',
                'Toggle Translation Direction',
              )}
            >
              <ArrowRightLeft className="size-4 text-violet-500" />
              <span className="w-16 text-center">
                {direction === 'target'
                  ? t('playground.form.dir_target', 'Target')
                  : t('playground.form.dir_native', 'Native')}
              </span>
            </button>
          </div>

          <div className="bg-violet-500/5 border border-violet-500/10 rounded-xl px-4 py-2.5">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {direction === 'target' ? (
                <>
                  <strong className="text-foreground font-semibold">
                    {t('playground.form.mode_target_title', 'Target Mode:')}
                  </strong>{' '}
                  {t(
                    'playground.form.mode_target_desc',
                    'Enter a word in the language you are learning (e.g. "bonjour") to create its dictionary note.',
                  )}
                </>
              ) : (
                <>
                  <strong className="text-foreground font-semibold">
                    {t('playground.form.mode_native_title', 'Native Mode:')}
                  </strong>{' '}
                  {t(
                    'playground.form.mode_native_desc',
                    'Enter a word in your native language (e.g. "hello") to translate it and create a note.',
                  )}
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
          <FieldLabel htmlFor="model">
            {t('playground.form.model_label', 'Model Selection')}
          </FieldLabel>
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
              <FieldLabel htmlFor="count">
                {t('playground.form.card_count', 'Card Count')}
              </FieldLabel>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground">
                {t('playground.form.cards', '{{count}} cards', { count })}
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
          {isSubmitting
            ? t('playground.form.creating', 'Creating...')
            : t('playground.form.create', 'Create')}
        </span>
      </Button>
    </form>
  );
}
