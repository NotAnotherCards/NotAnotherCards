import { useEffect, useRef, useState } from 'react';
import {
  createAiJobSchema,
  languageFor,
  type AiWordNoteCandidate,
} from '@repo/schemas';
import { AiJobFailedError } from '@repo/api-client';
import { useWordNoteGeneration } from '@repo/api-client/react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormErrorMessage } from '@/components/auth/form-error-message';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';

export interface WordGenerationDeck {
  deckId: string;
  nativeLanguageId: string;
  targetLanguageId: string;
}

export function WordNoteGeneration({
  deck,
  disabled,
  onBegin,
  onBusyChange,
}: {
  deck: WordGenerationDeck;
  disabled: boolean;
  onBegin: () => {
    word: string;
    direction: 'target' | 'native';
    apply: (candidate: AiWordNoteCandidate) => void;
  };
  onBusyChange: (busy: boolean) => void;
}) {
  const { t } = useTranslation();
  const generation = useWordNoteGeneration(apiClient);
  const { cancel } = generation;
  const generating = generation.status === 'generating';
  const paused = generation.status === 'paused';
  const [localError, setLocalError] = useState<string | null>(null);
  const apply = useRef<((candidate: AiWordNoteCandidate) => void) | null>(null);
  const native = languageFor(deck.nativeLanguageId);
  const target = languageFor(deck.targetLanguageId);
  const rawError =
    generation.error instanceof AiJobFailedError
      ? t('deck.word_generation.failed')
      : generation.error instanceof Error
        ? generation.error.name === 'ZodError'
          ? t('deck.word_generation.invalid')
          : generation.error.message
        : null;
  const error = localError
    ? t(localError, { defaultValue: localError })
    : rawError;

  useEffect(() => {
    onBusyChange(generating || paused);
  }, [generating, paused, onBusyChange]);
  useEffect(() => {
    setLocalError(cancel() ? 'deck.word_generation.invalid' : null);
    apply.current = null;
  }, [deck.deckId, deck.nativeLanguageId, deck.targetLanguageId, cancel]);

  const generate = async () => {
    if (generating || disabled) return;
    setLocalError(null);
    let fields;
    if (paused) {
      fields = await generation.resume();
    } else {
      const { word, direction, apply: applyResult } = onBegin();
      const parsed = createAiJobSchema.safeParse({
        type: 'word_note',
        deckId: deck.deckId,
        word,
        direction,
      });
      if (!parsed.success || parsed.data.type !== 'word_note') {
        setLocalError(t('deck.word_generation.enter_word'));
        return;
      }
      apply.current = applyResult;
      fields = await generation.generate({ ...parsed.data, ...deck });
    }
    if (!fields) return;
    try {
      // Keep the form's candidate-shaped callback; the shared call has already
      // validated these fields against both the AI response and note schemas.
      apply.current?.({
        noteType: 'word',
        fieldsVersion: 1,
        fields: {
          ...fields,
          part_of_speech: fields.part_of_speech ?? '',
          pronunciation: fields.pronunciation ?? '',
          example: fields.example ?? '',
          example_translation: fields.example_translation ?? '',
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('deck.word_generation.unable');
      setLocalError(t(message, message));
    }
  };

  return (
    <div className="w-full space-y-2">
      <Button
        type="button"
        disabled={disabled || generating || !native || !target}
        onClick={() => {
          void generate();
        }}
        // the same look as the playground's Start Card Generation button
        className="w-full bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-3xl py-5 shadow-lg shadow-indigo-500/10 font-semibold"
      >
        <span className="flex items-center justify-center gap-2">
          {generating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4 animate-pulse" />
          )}
          {paused
            ? t('deck.word_generation.check_again')
            : generating
              ? t('deck.word_generation.filling')
              : t('deck.word_generation.fill')}
        </span>
      </Button>
      {(generating || paused) && (
        <p role="status" className="text-sm">
          {paused
            ? t('deck.word_generation.running')
            : t('deck.word_generation.filling_note')}
        </p>
      )}
      {error && <FormErrorMessage message={error} />}
    </div>
  );
}
