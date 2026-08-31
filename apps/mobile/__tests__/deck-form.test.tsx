import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { DeckForm } from '@/components/deck-form';

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
});
