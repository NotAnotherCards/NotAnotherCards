import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { WordNoteForm } from '@/components/word-note-form';
import { ApiError } from '@repo/api-client';

const mockGenerate = jest.fn();
let mockConnected = true;
jest.mock('@/lib/api-client', () => ({
  apiClient: {
    ai: { generateWordNote: (...args: unknown[]) => mockGenerate(...args) },
  },
}));
jest.mock('@/lib/connectivity', () => ({ useConnected: () => mockConnected }));
const fields = {
  word: 'gato',
  translation: 'cat',
  part_of_speech: 'noun',
  example: 'El gato duerme.',
  example_translation: 'The cat sleeps.',
  native_language_id: 'en',
  target_language_id: 'es',
};
const props = {
  title: 'New word',
  deckId: 'd',
  nativeLanguageId: 'en',
  targetLanguageId: 'es',
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
};
beforeEach(() => {
  mockGenerate.mockReset();
  mockConnected = true;
});

it('fills empty fields but keeps edits made while generation runs', async () => {
  let finish!: (value: typeof fields) => void;
  mockGenerate.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const ui = render(
    <WordNoteForm {...props} initialValues={{ word: 'gato' }} />,
  );
  fireEvent.press(ui.getByLabelText('Fill in with AI'));
  expect(ui.getByText('Generating…')).toBeTruthy();
  fireEvent.changeText(ui.getByLabelText('Translation'), 'my cat');
  await act(async () => finish(fields));
  expect(ui.getByDisplayValue('my cat')).toBeTruthy();
  expect(ui.getByDisplayValue('noun')).toBeTruthy();
  expect(ui.getByDisplayValue('El gato duerme.')).toBeTruthy();
});

it.each([new Error('Model unavailable'), new ApiError('quota', 429)])(
  'keeps the form on failure and reports %s',
  async (error) => {
    mockGenerate.mockRejectedValue(error);
    const ui = render(
      <WordNoteForm
        {...props}
        initialValues={{ word: 'gato', translation: 'mine' }}
      />,
    );
    fireEvent.press(ui.getByLabelText('Fill in with AI'));
    await waitFor(() =>
      expect(
        ui.getByText(
          error instanceof ApiError
            ? 'Your AI quota is used up for today.'
            : error.message,
        ),
      ).toBeTruthy(),
    );
    expect(ui.getByDisplayValue('mine')).toBeTruthy();
  },
);

it('does not generate without a word or when offline', () => {
  const ui = render(<WordNoteForm {...props} />);
  fireEvent.press(ui.getByLabelText('Fill in with AI'));
  expect(mockGenerate).not.toHaveBeenCalled();
  mockConnected = false;
  ui.rerender(<WordNoteForm {...props} />);
  fireEvent.changeText(ui.getByLabelText('Word'), 'gato');
  fireEvent.press(ui.getByLabelText('Fill in with AI'));
  expect(mockGenerate).not.toHaveBeenCalled();
  expect(ui.getByText('Fill in needs a connection.')).toBeTruthy();
});

it('aborts on unmount', () => {
  mockGenerate.mockReturnValue(new Promise(() => {}));
  const ui = render(
    <WordNoteForm {...props} initialValues={{ word: 'gato' }} />,
  );
  fireEvent.press(ui.getByLabelText('Fill in with AI'));
  const signal = mockGenerate.mock.calls[0][1].signal as AbortSignal;
  ui.unmount();
  expect(signal.aborted).toBe(true);
});

it('does not fill a different word after the user changes it', async () => {
  let finish!: (value: typeof fields) => void;
  mockGenerate.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const ui = render(
    <WordNoteForm {...props} initialValues={{ word: 'gato' }} />,
  );
  fireEvent.press(ui.getByLabelText('Fill in with AI'));
  fireEvent.changeText(ui.getByLabelText('Word'), 'perro');
  await act(async () => finish(fields));
  expect(ui.queryByDisplayValue('cat')).toBeNull();
  expect(
    ui.getByText('The word changed. Fill in again for the new word.'),
  ).toBeTruthy();
});
