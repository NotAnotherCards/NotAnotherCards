import { useEffect, useRef, useState } from 'react';
import {
  aiJobResponseSchema,
  apiErrorBodySchema,
  createAiJobSchema,
  languageFor,
  type AiJob,
  type AiWordNoteCandidate,
} from '@repo/schemas';
import { WordNoteFieldsV1 } from '@repo/offline-db';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormErrorMessage } from '@/components/auth/form-error-message';

export interface WordGenerationDeck {
  deckId: string;
  nativeLanguageId: string;
  targetLanguageId: string;
}

type WordJob = Extract<AiJob, { type: 'word_note' }>;

async function readJob(response: Response): Promise<WordJob> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const { message } = apiErrorBodySchema.parse(body);
    throw new Error(message || 'Unable to generate a word. Please try again.');
  }
  const { job } = aiJobResponseSchema.parse(body);
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
  const [job, setJob] = useState<WordJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollPaused, setPollPaused] = useState(false);
  const startRequest = useRef<AbortController | null>(null);
  const apply = useRef<((candidate: AiWordNoteCandidate) => void) | null>(null);
  const handledJob = useRef<string | null>(null);
  const [filled, setFilled] = useState(false);
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
        const updated = await readJob(
          await fetch(`/api/ai/jobs/${encodeURIComponent(jobId)}`, {
            signal: controller.signal,
          }),
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
          'Unable to check generation. Check your connection and try again.',
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
    setFilled(false);
    setError(null);
    setJob(null);
    setPollPaused(false);
    try {
      const created = await readJob(
        await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
          signal: controller.signal,
        }),
      );
      if (!controller.signal.aborted) setJob(created);
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(
          err instanceof Error ? err.message : 'Unable to start generation.',
        );
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
      setFilled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fill the form.');
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
      {filled && (
        <p role="status" className="text-sm">
          Fields filled. Review and edit them before saving.
        </p>
      )}
      {error && <FormErrorMessage message={error} />}
      {job?.status === 'failed' && (
        <FormErrorMessage message="Generation failed. Your form has not changed. You can try again." />
      )}
    </div>
  );
}
