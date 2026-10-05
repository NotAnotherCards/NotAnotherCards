import { act, renderHook } from '@testing-library/react-native';
import { AiJobPollError } from '@repo/api-client';
import { useWordNoteGeneration } from '@repo/api-client/react';

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
};

it('pauses with the job and input, resumes, then resets a completed result', async () => {
  const error = new AiJobPollError('j', new Error('offline'));
  const generateWordNote = jest
    .fn()
    .mockRejectedValueOnce(error)
    .mockResolvedValueOnce(fields);
  const client = { ai: { generateWordNote } };
  const { result } = renderHook(() => useWordNoteGeneration(client));
  expect(result.current.status).toBe('idle');
  await act(async () => {
    await result.current.resume();
  });
  expect(generateWordNote).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.generate(input);
  });
  expect(result.current).toMatchObject({ status: 'paused', jobId: 'j', error });
  await act(async () => {
    await result.current.resume();
  });
  expect(generateWordNote).toHaveBeenLastCalledWith(
    input,
    expect.objectContaining({ jobId: 'j' }),
  );
  expect(result.current).toMatchObject({
    status: 'done',
    jobId: null,
    fields,
    error: null,
  });
  act(() => result.current.cancel());
  expect(result.current).toMatchObject({ status: 'idle', fields: null });
});

it('ignores duplicate starts and discards late results after cancel', async () => {
  let finish!: (value: typeof fields) => void;
  const generateWordNote = jest
    .fn()
    .mockImplementationOnce((_input, options) => {
      options.onJob('j');
      return new Promise((resolve) => {
        finish = resolve;
      });
    })
    .mockResolvedValueOnce({ ...fields, word: 'perro' });
  const client = { ai: { generateWordNote } };
  const { result } = renderHook(() => useWordNoteGeneration(client));
  let pending!: ReturnType<typeof result.current.generate>;
  act(() => {
    pending = result.current.generate(input);
    void result.current.generate(input);
  });
  expect(generateWordNote).toHaveBeenCalledTimes(1);
  expect(result.current).toMatchObject({ status: 'generating', jobId: 'j' });
  act(() => result.current.cancel());
  expect(generateWordNote.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => {
    await result.current.generate({ ...input, word: 'perro' });
  });
  await act(async () => {
    finish(fields);
    await pending;
  });
  expect(result.current.fields?.word).toBe('perro');
});

it('keeps non-poll failures raw and forgets them on cancel', async () => {
  const error = new Error('failed');
  const client = {
    ai: { generateWordNote: jest.fn().mockRejectedValue(error) },
  };
  const { result } = renderHook(() => useWordNoteGeneration(client));
  await act(async () => {
    await result.current.generate(input);
  });
  expect(result.current).toMatchObject({
    status: 'failed',
    error,
    jobId: null,
  });
  act(() => result.current.cancel());
  expect(result.current).toMatchObject({ status: 'idle', error: null });
});

it('aborts on unmount, including when the client ignores the signal', async () => {
  let finish!: (value: typeof fields) => void;
  const generateWordNote = jest.fn().mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const client = { ai: { generateWordNote } };
  const { result, unmount } = renderHook(() => useWordNoteGeneration(client));
  let pending!: ReturnType<typeof result.current.generate>;
  act(() => {
    pending = result.current.generate(input);
  });
  unmount();
  expect(generateWordNote.mock.calls[0][1].signal.aborted).toBe(true);
  finish(fields);
  await expect(pending).resolves.toBeUndefined();
});
