import { afterEach, expect, it, vi } from 'vitest';
import { createApiClient, AiJobFailedError, ApiError } from './index.js';

afterEach(() => vi.useRealTimers());

it('keeps the job id on a failed poll and resumes without another generation', async () => {
  vi.useFakeTimers();
  const { ai, fetch } = setup(job('pending'));
  fetch.mockRejectedValueOnce(new Error('Network lost'));
  const onJob = vi.fn();
  const result = ai
    .generateWordNote(input, { onJob })
    .catch((error: unknown) => error);
  await vi.advanceTimersByTimeAsync(1000);
  expect(await result).toMatchObject({ name: 'AiJobPollError', jobId: 'a/b' });
  expect(onJob).toHaveBeenCalledWith('a/b');
  fetch.mockResolvedValueOnce(new Response(JSON.stringify(job('completed'))));
  await expect(ai.generateWordNote(input, { jobId: 'a/b' })).resolves.toEqual(
    fields,
  );
  expect(
    fetch.mock.calls.filter(([, init]) => init?.method === 'POST'),
  ).toHaveLength(1);
  expect(fetch).toHaveBeenLastCalledWith(
    '/api/ai/jobs/a%2Fb',
    expect.anything(),
  );
});

it('validates the identity and languages on resume without posting', async () => {
  for (const response of [
    job('completed', { id: 'other' }),
    job('completed'),
  ]) {
    const { ai, fetch } = setup(response);
    await expect(
      ai.generateWordNote(
        { ...input, targetLanguageId: 'fr' },
        { jobId: 'a/b' },
      ),
    ).rejects.toThrow();
    expect(fetch.mock.calls.every(([, init]) => init?.method !== 'POST')).toBe(
      true,
    );
  }
});

it('distinguishes a failed resumed job and an aborted poll from poll failure', async () => {
  await expect(
    setup(job('failed', { error: 'Model unavailable' })).ai.generateWordNote(
      input,
      { jobId: 'a/b' },
    ),
  ).rejects.toBeInstanceOf(AiJobFailedError);
  const { ai, fetch } = setup();
  fetch.mockImplementation(() => new Promise(() => {}));
  const controller = new AbortController();
  const result = ai.generateWordNote(input, {
    jobId: 'a/b',
    signal: controller.signal,
  });
  controller.abort();
  await expect(result).rejects.toMatchObject({ name: 'AbortError' });
});
const input = {
  deckId: 'd',
  word: 'gato',
  direction: 'target' as const,
  nativeLanguageId: 'en',
  targetLanguageId: 'es',
};
const fields = {
  word: 'gato',
  translation: 'cat',
  native_language_id: 'en',
  target_language_id: 'es',
  part_of_speech: 'noun',
  pronunciation: 'gato',
  example: 'El gato duerme.',
  example_translation: 'The cat sleeps.',
};
const job = (status: string, overrides = {}) => ({
  job: {
    id: 'a/b',
    type: 'word_note',
    status,
    createdAt: '2026-10-01',
    payload: {
      ...input,
      nativeLanguageName: 'English',
      targetLanguageName: 'Spanish',
    },
    result:
      status === 'completed'
        ? { noteType: 'word', fieldsVersion: 1, fields }
        : null,
    ...overrides,
  },
});
function setup(...responses: unknown[]) {
  const fetch = vi.fn<typeof globalThis.fetch>();
  for (const body of responses)
    fetch.mockResolvedValueOnce(new Response(JSON.stringify(body)));
  return { fetch, ai: createApiClient({ baseUrl: '', fetch }).ai };
}

it('starts once, polls every second, validates and reports status', async () => {
  vi.useFakeTimers();
  const { fetch, ai } = setup(
    job('pending'),
    job('processing'),
    job('completed'),
  );
  const onStatus = vi.fn();
  const result = ai.generateWordNote(input, { onStatus });
  await vi.advanceTimersByTimeAsync(999);
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1001);
  await expect(result).resolves.toEqual(fields);
  expect(fetch).toHaveBeenNthCalledWith(
    1,
    '/api/ai/generate',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        type: 'word_note',
        deckId: 'd',
        word: 'gato',
        direction: 'target',
      }),
    }),
  );
  expect(fetch).toHaveBeenNthCalledWith(
    2,
    '/api/ai/jobs/a%2Fb',
    expect.objectContaining({ signal: expect.anything() }),
  );
  expect(onStatus.mock.calls.flat()).toEqual([
    'pending',
    'processing',
    'completed',
  ]);
});

it('keeps the failed job message and type', async () => {
  const error = setup(
    job('failed', { error: 'Model unavailable' }),
  ).ai.generateWordNote(input);
  await expect(error).rejects.toBeInstanceOf(AiJobFailedError);
  await expect(error).rejects.toThrow('Model unavailable');
});

it('aborts between polls without another request or timer', async () => {
  vi.useFakeTimers();
  const { ai, fetch } = setup(job('pending'));
  const controller = new AbortController();
  const result = ai.generateWordNote(input, { signal: controller.signal });
  const check = expect(result).rejects.toMatchObject({ name: 'AbortError' });
  await vi.advanceTimersByTimeAsync(500);
  controller.abort();
  await check;
  await vi.advanceTimersByTimeAsync(5000);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it('rejects mismatched languages and invalid fields', async () => {
  await expect(
    setup(job('completed')).ai.generateWordNote({
      ...input,
      targetLanguageId: 'fr',
    }),
  ).rejects.toThrow('languages');
  await expect(
    setup(
      job('completed', {
        result: {
          noteType: 'word',
          fieldsVersion: 1,
          fields: { ...fields, word: '' },
        },
      }),
    ).ai.generateWordNote(input),
  ).rejects.toThrow();
});

it('rejects a different polled job', async () => {
  vi.useFakeTimers();
  const { ai } = setup(job('pending'), job('completed', { id: 'other' }));
  const check = expect(ai.generateWordNote(input)).rejects.toThrow(
    'Unexpected generation job',
  );
  await vi.advanceTimersByTimeAsync(1000);
  await check;
});

it('preserves quota 429 as ApiError', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    new Response(JSON.stringify({ message: 'Quota exceeded' }), {
      status: 429,
    }),
  );
  const result = createApiClient({ baseUrl: '', fetch }).ai.generateWordNote(
    input,
  );
  await expect(result).rejects.toBeInstanceOf(ApiError);
  await expect(result).rejects.toMatchObject({ status: 429 });
});
