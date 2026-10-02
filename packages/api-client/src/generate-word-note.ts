import {
  createAiJobSchema,
  type AiJob,
  type AiJobStatus,
  type CreateAiJobInput,
} from '@repo/schemas';
import { WordNoteFieldsV1 } from '@repo/study';
import type { RequestOptions } from './transport.js';

export type WordNoteGenerationInput = Omit<
  Extract<CreateAiJobInput, { type: 'word_note' }>,
  'type'
> & {
  nativeLanguageId: string;
  targetLanguageId: string;
};

export interface WordNoteGenerationOptions {
  signal?: AbortSignal;
  pollMs?: number;
  onStatus?: (status: AiJobStatus) => void;
  onJob?: (id: string) => void;
  /** Resume polling this job without submitting or spending quota again. */
  jobId?: string;
}

export class AiJobPollError extends Error {
  constructor(
    readonly jobId: string,
    readonly cause: unknown,
  ) {
    super('Unable to check generation. Check your connection and try again.');
    this.name = 'AiJobPollError';
  }
}

export class AiJobFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiJobFailedError';
  }
}

function cancelled() {
  const error = new Error('The request was cancelled.');
  error.name = 'AbortError';
  return error;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(cancelled());
    const abort = () => {
      clearTimeout(timer);
      reject(cancelled());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

// Both UIs use the same start/poll/validate contract. No database or UI state.
export async function generateWordNote(
  ai: {
    generate(
      input: CreateAiJobInput,
      options?: RequestOptions,
    ): Promise<{ job: AiJob }>;
    job(id: string, options?: RequestOptions): Promise<{ job: AiJob }>;
  },
  input: WordNoteGenerationInput,
  {
    signal,
    pollMs = 1000,
    onStatus,
    onJob,
    jobId,
  }: WordNoteGenerationOptions = {},
) {
  const request = createAiJobSchema.parse({ ...input, type: 'word_note' });
  if (signal?.aborted) throw cancelled();
  const poll = async (id: string) => {
    try {
      return await ai.job(id, { signal });
    } catch (error) {
      if (
        signal?.aborted ||
        (error instanceof Error && error.name === 'AbortError')
      )
        throw error;
      throw new AiJobPollError(id, error);
    }
  };
  let { job } =
    jobId === undefined
      ? await ai.generate(request, { signal })
      : await poll(jobId);
  const id = jobId ?? job.id;
  onJob?.(id);
  for (;;) {
    if (signal?.aborted) throw cancelled();
    if (
      job.type !== 'word_note' ||
      job.id !== id ||
      job.payload.deckId !== input.deckId
    )
      throw new Error('Unexpected generation job.');
    onStatus?.(job.status);
    if (job.status === 'failed')
      throw new AiJobFailedError(job.error || 'Generation failed. Try again.');
    if (job.status === 'completed') {
      const fields = WordNoteFieldsV1.parse(job.result?.fields);
      if (
        job.payload.nativeLanguageId !== input.nativeLanguageId ||
        job.payload.targetLanguageId !== input.targetLanguageId ||
        fields.native_language_id !== input.nativeLanguageId ||
        fields.target_language_id !== input.targetLanguageId
      )
        throw new Error(
          'The generated languages no longer match the deck. Try again.',
        );
      return fields;
    }
    await wait(pollMs, signal);
    ({ job } = await poll(id));
  }
}
