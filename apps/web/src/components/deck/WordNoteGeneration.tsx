import { useEffect, useRef, useState } from 'react';
import {
  createAiJobSchema,
  languageFor,
  type AiJob,
  type AiWordNoteCandidate,
} from '@repo/schemas';
import { WordNoteFieldsV1 } from '@repo/offline-db';
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

type WordJob = Extract<AiJob, { type: 'word_note' }>;

function wordJob(job: AiJob): WordJob {
  if (job.type !== 'word_note')
    throw new Error('Unexpected generation result.');
  return job;
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
  const [job, setJob] = useState<WordJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollPaused, setPollPaused] = useState(false);
  const startRequest = useRef<AbortController | null>(null);
  const apply = useRef<((candidate: AiWordNoteCandidate) => void) | null>(null);
  const handledJob = useRef<string | null>(null);
  const pending = job?.status === 'pending' || job?.status === 'processing';
  const jobId = job?.id;
  const native = languageFor(deck.nativeLanguageId);
  const target = languageFor(deck.targetLanguageId);

  useEffect(() => () => startRequest.current?.abort(), []);
  useEffect(() => {
    onBusyChange(starting || pending);
  }, [starting, pending, onBusyChange]);

  useEffect(() => {
    if (!jobId || !pending || pollPaused) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const updated = wordJob(
          (
            await apiClient.ai.job(jobId, {
              signal: controller.signal,
            })
          ).job,
        );
        if (controller.signal.aborted) return;
        if (updated.id !== jobId) throw new Error('Unexpected generation job.');
        setJob(updated);
        if (updated.status === 'pending' || updated.status === 'processing') {
          timer = setTimeout(() => void poll(), 1000);
        }
      } catch {
        if (controller.signal.aborted) return;
        setError(
          t(
            'ai.validation.network_error',
            'Unable to check generation. Check your connection and try again.',
          ),
        );
        setPollPaused(true);
      }
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [jobId, pending, pollPaused]);

  const generate = async () => {
    if (startRequest.current || pending || disabled) return;
    const { word, direction, apply: applyResult } = onBegin();
    const parsed = createAiJobSchema.safeParse({
      type: 'word_note',
      deckId: deck.deckId,
      word,
      direction,
    });
    if (!parsed.success) {
      setError('Enter a word or translation of up to 100 characters first.');
      return;
    }
    const controller = new AbortController();
    startRequest.current = controller;
    setStarting(true);
    apply.current = applyResult;
    handledJob.current = null;
    setError(null);
    setJob(null);
    setPollPaused(false);
    try {
      const created = wordJob(
        (
          await apiClient.ai.generate(parsed.data, {
            signal: controller.signal,
          })
        ).job,
      );
      if (!controller.signal.aborted) setJob(created);
    } catch (err) {
      if (!controller.signal.aborted) {
        const rawMessage =
          err instanceof Error ? err.message : 'Unable to start generation.';
        setError(t(rawMessage, rawMessage) as string);
      }
    } finally {
      if (!controller.signal.aborted) setStarting(false);
      startRequest.current = null;
    }
  };

  useEffect(() => {
    if (!job || job.status !== 'completed' || handledJob.current === job.id)
      return;
    handledJob.current = job.id;
    const result = job.result;
    const parsedFields = WordNoteFieldsV1.safeParse(result?.fields);
    const matchesDeck =
      job.payload.deckId === deck.deckId &&
      job.payload.nativeLanguageId === deck.nativeLanguageId &&
      job.payload.targetLanguageId === deck.targetLanguageId &&
      result?.fields.native_language_id === deck.nativeLanguageId &&
      result?.fields.target_language_id === deck.targetLanguageId;
    if (!result || !parsedFields.success || !matchesDeck) {
      setError(
        'The generated fields are invalid or their languages no longer match the deck. Try again.',
      );
      return;
    }
    try {
      apply.current?.(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('ai.validation.fill_error', 'Unable to fill the form.'),
      );
    }
  }, [job, deck.deckId, deck.nativeLanguageId, deck.targetLanguageId]);

  return (
    <div className="w-full space-y-2">
      <Button
        type="button"
        disabled={
          disabled || starting || (pending && !pollPaused) || !native || !target
        }
        onClick={() => {
          if (pollPaused) {
            setError(null);
            setPollPaused(false);
          } else void generate();
        }}
        // the same look as the playground's Start Card Generation button
        className="w-full bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-3xl py-5 shadow-lg shadow-indigo-500/10 font-semibold"
      >
        <span className="flex items-center justify-center gap-2">
          {(starting || pending) && !pollPaused ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4 animate-pulse" />
          )}
          {pollPaused
            ? 'Check generation again'
            : starting || pending
              ? 'Filling…'
              : 'Fill with AI'}
        </span>
      </Button>
      {pending && (
        <p role="status" className="text-sm">
          {pollPaused
            ? 'Generation may still be running.'
            : 'Filling your word note…'}
        </p>
      )}
      {error && <FormErrorMessage message={error} />}
      {job?.status === 'failed' && (
        <FormErrorMessage message="Generation failed. Your form has not changed. You can try again." />
      )}
    </div>
  );
}
