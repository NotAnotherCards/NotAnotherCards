import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ENGLISH, GERMAN, SPANISH } from '@repo/schemas';
import { WordNoteForm } from '../components/deck/WordNoteForm';

const deck = {
  deckId: 'deck-1',
  nativeLanguageId: ENGLISH,
  targetLanguageId: GERMAN,
};
const fields = {
  word: 'Hund',
  translation: 'dog',
  native_language_id: ENGLISH,
  target_language_id: GERMAN,
  part_of_speech: 'noun',
  gender: 'der',
  example: 'Der Hund läuft.',
  example_translation: 'The dog runs.',
  pronunciation: 'hʊnt',
};
const job = (status: 'pending' | 'completed' | 'failed' = 'completed') => ({
  id: 'job-1',
  type: 'word_note',
  status,
  createdAt: '2026-09-06T12:00:00Z',
  payload: {
    ...deck,
    nativeLanguageName: 'English',
    targetLanguageName: 'German',
    word: 'Hund',
    direction: 'target',
  },
  result:
    status === 'completed'
      ? { noteType: 'word', fieldsVersion: 1, fields }
      : null,
});
const response = (value: unknown, ok = true) =>
  ({ ok, json: async () => value }) as Response;
const start = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Fill with AI' }));
const props = () => ({
  title: 'Add New Word',
  generationDeck: deck,
  targetLanguageId: GERMAN,
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
});

afterEach(() => vi.unstubAllGlobals());

describe('AI autofill in the existing word form', () => {
  it.each(['target', 'native'] as const)(
    'uses the existing %s input and fills editable fields without saving',
    async (direction) => {
      const result = job();
      result.payload.direction = direction;
      result.payload.word = direction === 'target' ? 'Hund' : 'dog';
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          response({ job: { ...result, status: 'pending', result: null } }),
        )
        .mockResolvedValueOnce(response({ job: result }));
      vi.stubGlobal('fetch', fetchMock);
      const formProps = props();
      render(
        <WordNoteForm
          {...formProps}
          initialData={{
            word: direction === 'target' ? ' Hund ' : '',
            translation: direction === 'native' ? ' dog ' : '',
            notes: 'Keep me',
          }}
        />,
      );
      start();
      await screen.findByText(/Fields filled/);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
        type: 'word_note',
        deckId: 'deck-1',
        word: result.payload.word,
        direction,
      });
      expect(screen.queryByLabelText('Word to generate')).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Use candidate' }),
      ).toBeNull();
      expect(formProps.onSubmit).not.toHaveBeenCalled();
      expect(screen.getByLabelText(/^word$/i)).toHaveValue('Hund');
      expect(screen.getByLabelText(/^notes$/i)).toHaveValue('Keep me');
      fireEvent.change(screen.getByLabelText(/^translation$/i), {
        target: { value: 'a dog' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() =>
        expect(formProps.onSubmit).toHaveBeenCalledWith({
          word: 'Hund',
          translation: 'a dog',
          notes: 'Keep me',
          part_of_speech: 'noun',
          gender: 'der',
          example: fields.example,
          example_translation: fields.example_translation,
          pronunciation: 'hʊnt',
        }),
      );
    },
  );

  it('does not submit a generation request with empty fields', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<WordNoteForm {...props()} />);
    start();
    await screen.findByText(/Enter a word or translation/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resumes checking the same pending job after a network error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ job: job('pending') }))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(response({ job: job() }));
    vi.stubGlobal('fetch', fetchMock);
    render(<WordNoteForm {...props()} initialData={{ word: 'Hund' }} />);
    start();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Check generation again' }),
    );
    await screen.findByText(/Fields filled/);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/ai/generate',
      '/api/ai/jobs/job-1',
      '/api/ai/jobs/job-1',
    ]);
  });

  it('allows retrying a failed job without changing the form', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ job: job('failed') }))
      .mockResolvedValueOnce(response({ job: job() }));
    vi.stubGlobal('fetch', fetchMock);
    render(<WordNoteForm {...props()} initialData={{ word: 'Hund' }} />);
    start();
    await screen.findByText(/Generation failed/);
    expect(screen.getByLabelText(/^word$/i)).toHaveValue('Hund');
    start();
    await screen.findByText(/Fields filled/);
  });

  it('shows quota errors without losing entered fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          response({ message: 'Active generation cap reached' }, false),
        ),
    );
    render(<WordNoteForm {...props()} initialData={{ word: 'Hund' }} />);
    start();
    await screen.findByText('Active generation cap reached');
    expect(screen.getByLabelText(/^word$/i)).toHaveValue('Hund');
  });

  it('rejects invalid generated fields', async () => {
    const invalid = job();
    invalid.result = { ...invalid.result!, fields: { ...fields, word: '' } };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ job: invalid })),
    );
    render(<WordNoteForm {...props()} initialData={{ word: 'Hund' }} />);
    start();
    await screen.findByText(/generated fields are invalid/);
    expect(screen.getByLabelText(/^translation$/i)).toHaveValue('');
  });

  it('preserves edits made while generation is running', async () => {
    let complete!: (value: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            complete = resolve;
          }),
      ),
    );
    render(<WordNoteForm {...props()} initialData={{ word: 'Hund' }} />);
    start();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^word$/i), {
      target: { value: 'Katze' },
    });
    await act(async () => complete(response({ job: job() })));
    await screen.findByText(/Your edits were kept/);
    expect(screen.getByLabelText(/^word$/i)).toHaveValue('Katze');
    expect(screen.getByLabelText(/^translation$/i)).toHaveValue('');
  });

  it('rejects a response if the deck languages changed while it was running', async () => {
    let complete!: (value: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            complete = resolve;
          }),
      ),
    );
    const formProps = props();
    const { rerender } = render(
      <WordNoteForm {...formProps} initialData={{ word: 'Hund' }} />,
    );
    start();
    rerender(
      <WordNoteForm
        {...formProps}
        generationDeck={{ ...deck, targetLanguageId: SPANISH }}
        targetLanguageId={SPANISH}
      />,
    );
    await act(async () => complete(response({ job: job() })));
    await screen.findByText(/languages no longer match/);
    expect(screen.getByLabelText(/^translation$/i)).toHaveValue('');
  });

  it('blocks saving filled fields after the deck languages change', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ job: job() })));
    const formProps = props();
    const { rerender } = render(
      <WordNoteForm {...formProps} initialData={{ word: 'Hund' }} />,
    );
    start();
    await screen.findByText(/Fields filled/);
    rerender(
      <WordNoteForm
        {...formProps}
        generationDeck={{ ...deck, targetLanguageId: SPANISH }}
        targetLanguageId={SPANISH}
      />,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(formProps.onSubmit).not.toHaveBeenCalled();
  });

  it('aborts outstanding requests when the form closes', () => {
    const fetchMock = vi.fn().mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    const { unmount } = render(
      <WordNoteForm {...props()} initialData={{ word: 'Hund' }} />,
    );
    start();
    unmount();
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });
});
