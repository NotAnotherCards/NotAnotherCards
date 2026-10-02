import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createApiClient } from '@repo/api-client';
import { ENGLISH, SPANISH } from '@repo/schemas';
import { WordNoteGeneration } from '@/components/deck/WordNoteGeneration';

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock('@/lib/api-client', () => ({
  apiClient: { ai: { generateWordNote: generate } },
}));

it('keeps the paused UI and applies a resumed result after just one POST', async () => {
  const deck = {
    deckId: 'd',
    nativeLanguageId: ENGLISH,
    targetLanguageId: SPANISH,
  };
  const fields = {
    word: 'gato',
    translation: 'cat',
    native_language_id: ENGLISH,
    target_language_id: SPANISH,
    part_of_speech: 'noun',
    pronunciation: 'gato',
    example: 'El gato duerme.',
    example_translation: 'The cat sleeps.',
  };
  const job = {
    id: 'j',
    type: 'word_note',
    status: 'pending',
    createdAt: '2026-10-02',
    payload: {
      ...deck,
      word: 'gato',
      direction: 'target',
      nativeLanguageName: 'English',
      targetLanguageName: 'Spanish',
    },
  };
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(new Response(JSON.stringify({ job })))
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          job: {
            ...job,
            status: 'completed',
            result: { noteType: 'word', fieldsVersion: 1, fields },
          },
        }),
      ),
    );
  const client = createApiClient({ baseUrl: '', fetch });
  generate.mockImplementation((input, options) =>
    client.ai.generateWordNote(input, { ...options, pollMs: 0 }),
  );
  const apply = vi.fn();
  const onBusyChange = vi.fn();
  render(
    <WordNoteGeneration
      deck={deck}
      disabled={false}
      onBegin={() => ({ word: 'gato', direction: 'target', apply })}
      onBusyChange={onBusyChange}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Fill with AI' }));
  await screen.findByText('Generation may still be running.');
  expect(onBusyChange).toHaveBeenLastCalledWith(true);
  fireEvent.click(
    screen.getByRole('button', { name: 'Check generation again' }),
  );
  await waitFor(() =>
    expect(apply).toHaveBeenCalledExactlyOnceWith({
      noteType: 'word',
      fieldsVersion: 1,
      fields,
    }),
  );
  expect(
    fetch.mock.calls.filter(([, init]) => init?.method === 'POST'),
  ).toHaveLength(1);
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
});
