import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { DeckForm } from '@/components/deck-form';
import { ENGLISH, GERMAN } from '@repo/schemas';

describe('DeckForm', () => {
  it('requires a title and does not submit without one', async () => {
    const onSubmit = jest.fn();
    const { getByText } = render(
      <DeckForm title="New deck" onSubmit={onSubmit} onCancel={jest.fn()} />,
    );
    fireEvent.press(getByText('Save'));
    await waitFor(() => getByText('Deck title is required'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits trimmed values and an empty description as empty string', async () => {
    const onSubmit = jest.fn(() => Promise.resolve());
    const { getByPlaceholderText, getByText } = render(
      <DeckForm title="New deck" onSubmit={onSubmit} onCancel={jest.fn()} />,
    );
    fireEvent.changeText(
      getByPlaceholderText('e.g. Spanish vocabulary'),
      '  Spanish  ',
    );
    fireEvent.press(getByText('Save'));
    await act(async () => {});
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Spanish',
      description: '',
      noteType: 'basic',
      nativeLanguageId: '',
      targetLanguageId: '',
    });
  });

  it('starts from the initial values when editing', () => {
    const { getByDisplayValue } = render(
      <DeckForm
        title="Edit deck"
        initialValues={{ title: 'Yoga', description: 'Poses' }}
        onSubmit={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(getByDisplayValue('Yoga')).toBeTruthy();
    expect(getByDisplayValue('Poses')).toBeTruthy();
  });

  it('associates each label with its input', () => {
    const { getByLabelText } = render(
      <DeckForm title="New deck" onSubmit={jest.fn()} onCancel={jest.fn()} />,
    );

    expect(getByLabelText('Deck title')).toHaveProp(
      'placeholder',
      'e.g. Spanish vocabulary',
    );
    expect(getByLabelText('Description')).toHaveProp('placeholder', 'Optional');
  });

  it('creates a word deck with two different languages', async () => {
    const onSubmit = jest.fn(() => Promise.resolve());
    const r = render(
      <DeckForm
        title="New deck"
        showNoteType
        defaultLanguages={{
          nativeLanguageId: ENGLISH,
          targetLanguageId: GERMAN,
        }}
        onSubmit={onSubmit}
        onCancel={jest.fn()}
      />,
    );
    fireEvent.changeText(
      r.getByPlaceholderText('e.g. Spanish vocabulary'),
      'German',
    );
    fireEvent.press(r.getByLabelText('Words'));
    fireEvent.press(r.getByText('Save'));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        title: 'German',
        description: '',
        noteType: 'word',
        nativeLanguageId: ENGLISH,
        targetLanguageId: GERMAN,
      }),
    );
  });
});
