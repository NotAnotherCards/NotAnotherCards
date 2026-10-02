import { useCallback, useEffect, useRef, useState } from 'react';
import type { WordNoteFields } from '@repo/study';
import type { createApiClient } from '../client.js';
import {
  AiJobPollError,
  type WordNoteGenerationInput,
} from '../generate-word-note.js';

type Client = {
  ai: Pick<ReturnType<typeof createApiClient>['ai'], 'generateWordNote'>;
};
export interface WordNoteGenerationState {
  status: 'idle' | 'generating' | 'paused' | 'done' | 'failed';
  jobId: string | null;
  error: unknown;
  fields: WordNoteFields | null;
}
const idle: WordNoteGenerationState = {
  status: 'idle',
  jobId: null,
  error: null,
  fields: null,
};

export function useWordNoteGeneration(
  client: Client,
  { pollMs }: { pollMs?: number } = {},
) {
  const [state, setState] = useState(idle);
  const request = useRef<AbortController | null>(null);
  const paused = useRef<{
    input: WordNoteGenerationInput;
    jobId: string;
  } | null>(null);

  useEffect(
    () => () => {
      request.current?.abort();
      request.current = null;
    },
    [],
  );

  // Return whether work was interrupted, so a UI can explain input changes.
  const cancel = useCallback(() => {
    const interrupted = request.current !== null;
    request.current?.abort();
    request.current = null;
    paused.current = null;
    setState(idle);
    return interrupted;
  }, []);

  const run = useCallback(
    async (input: WordNoteGenerationInput, jobId?: string) => {
      if (request.current) return;
      const controller = new AbortController();
      request.current = controller;
      paused.current = null;
      setState({ ...idle, status: 'generating', jobId: jobId ?? null });
      try {
        const fields = await client.ai.generateWordNote(input, {
          signal: controller.signal,
          pollMs,
          pollImmediately: true,
          jobId,
          onJob: (id) => {
            if (!controller.signal.aborted)
              setState((current) => ({ ...current, jobId: id }));
          },
        });
        if (controller.signal.aborted) return;
        setState({ ...idle, status: 'done', fields });
        return fields;
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof AiJobPollError) {
          paused.current = { input: { ...input }, jobId: error.jobId };
          setState({ ...idle, status: 'paused', jobId: error.jobId, error });
        } else {
          setState({ ...idle, status: 'failed', error });
        }
      } finally {
        if (request.current === controller) request.current = null;
      }
    },
    [client, pollMs],
  );

  const generate = useCallback(
    (input: WordNoteGenerationInput) => run(input),
    [run],
  );
  const resume = useCallback(() => {
    const pending = paused.current;
    return pending
      ? run(pending.input, pending.jobId)
      : Promise.resolve(undefined);
  }, [run]);
  return { ...state, generate, resume, cancel };
}
