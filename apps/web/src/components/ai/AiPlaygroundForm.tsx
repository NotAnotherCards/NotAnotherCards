import React, { useState } from 'react';
import { CreateAiJobInput, AI_MODELS, AiModel } from '@repo/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field';
import { Sparkles } from 'lucide-react';

interface QuotaData {
  used: number;
  limit: number;
}

interface AiPlaygroundFormProps {
  quota: QuotaData | null;
  onSubmit: (data: CreateAiJobInput) => void;
  isSubmitting: boolean;
}

export function AiPlaygroundForm({ quota, onSubmit, isSubmitting }: AiPlaygroundFormProps) {
  const [type, setType] = useState<'topic_deck' | 'text_cards'>('topic_deck');
  const [topic, setTopic] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [count, setCount] = useState(5);
  const [model, setModel] = useState<AiModel>('qwen');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (type === 'topic_deck' && !topic.trim()) {
      setError('Subject/Topic cannot be empty');
      return;
    }

    if (type === 'text_cards' && !sourceText.trim()) {
      setError('Source text cannot be empty');
      return;
    }

    onSubmit({
      type,
      topic: type === 'topic_deck' ? topic : undefined,
      sourceText: type === 'text_cards' ? sourceText : undefined,
      count,
      model,
    });
  };

  const quotaPercent = quota ? Math.min((quota.used / quota.limit) * 100, 100) : 0;
  const isQuotaExceeded = quota ? quota.used >= quota.limit : false;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Quota Indicator */}
      <div className="bg-card/40 border border-border/50 rounded-2xl p-4 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="size-4 text-amber-500 animate-pulse" />
            AI Quota Status
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {quota ? `${quota.used}/${quota.limit} jobs used` : 'Loading quota...'}
          </span>
        </div>
        <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              isQuotaExceeded ? 'bg-destructive' : 'bg-linear-to-r from-violet-500 to-indigo-500'
            }`}
            style={{ width: `${quota ? quotaPercent : 0}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Quotas reset daily. Use the models playground to tweak options and preview payload structures.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-muted/50 p-1 rounded-xl border border-border/40">
        <button
          type="button"
          onClick={() => { setType('topic_deck'); setError(null); }}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
            type === 'topic_deck'
              ? 'bg-background text-foreground shadow-sm shadow-black/10'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Topic Deck
        </button>
        <button
          type="button"
          onClick={() => { setType('text_cards'); setError(null); }}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
            type === 'text_cards'
              ? 'bg-background text-foreground shadow-sm shadow-black/10'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Source Text
        </button>
      </div>

      {/* Dynamic Content Fields */}
      {type === 'topic_deck' ? (
        <Field className="space-y-2">
          <FieldLabel htmlFor="topic">Subject / Topic</FieldLabel>
          <FieldDescription>Describe what you want to learn (e.g. "Spanish Nouns", "Irregular French Verbs").</FieldDescription>
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
      ) : (
        <Field className="space-y-2">
          <FieldLabel htmlFor="sourceText">Source Text</FieldLabel>
          <FieldDescription>Paste study guides, paragraphs, or vocabulary lists to extract flashcards from.</FieldDescription>
          <textarea
            id="sourceText"
            rows={5}
            placeholder="Paste text up to 10,000 characters here..."
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value.slice(0, 10000))}
            maxLength={10000}
            className="w-full min-w-0 rounded-2xl border border-border/60 bg-input/50 px-3 py-2 text-base transition-all placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none disabled:opacity-50 md:text-sm resize-y"
          />
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Limit 10,000 chars</span>
            <span>{sourceText.length}/10,000</span>
          </div>
        </Field>
      )}

      {/* Configuration Sliders & Dropdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Model Selector */}
        <Field className="space-y-2">
          <FieldLabel htmlFor="model">Model Selection</FieldLabel>
          <div className="relative">
            <select
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value as AiModel)}
              className="w-full rounded-3xl border border-border/60 bg-input/50 px-3 py-2 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 outline-none appearance-none cursor-pointer"
            >
              {AI_MODELS.map((m) => {
                let displayName: string = m;
                if (m === 'qwen') displayName = 'Qwen (Fast)';
                else if (m === 'qwen-next-80b') displayName = 'Qwen Next 80B (Smart)';
                else if (m === 'mistral-small') displayName = 'Mistral Small';
                else if (m === 'Qwen/Qwen3.6-35B-A3B') displayName = 'Qwen 3.6 35B (NanoGPT)';
                else if (m === 'google/gemma-2-27b-it') displayName = 'Gemma 2 27B (NanoGPT)';
                return (
                  <option key={m} value={m} className="bg-background text-foreground">
                    {displayName}
                  </option>
                );
              })}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
              ▼
            </div>
          </div>
        </Field>

        {/* Card Count Selector */}
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
      </div>

      {error && <FieldError>{error}</FieldError>}

      <Button
        type="submit"
        disabled={isSubmitting || isQuotaExceeded}
        className="w-full bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-3xl py-5 shadow-lg shadow-indigo-500/10 font-semibold group relative overflow-hidden"
      >
        <span className="flex items-center justify-center gap-2">
          <Sparkles className="size-4 animate-pulse" />
          {isSubmitting ? 'Generating Cards...' : 'Start Card Generation'}
        </span>
      </Button>
    </form>
  );
}
