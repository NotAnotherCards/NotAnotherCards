import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { CardForm } from '@/components/card-form';
import { renderWithLocale } from '@/lib/test-utils/render-with-locale';

describe('CardForm', () => {
  it('updates German labels and existing validation when switching to Spanish', async () => {
    const screen = await renderWithLocale(
      <CardForm title="Test" onSubmit={jest.fn()} onCancel={jest.fn()} />,
      'de',
    );
    fireEvent.press(screen.getByText('Speichern'));
    expect(
      await screen.findByText('Die Vorderseite ist erforderlich.'),
    ).toBeTruthy();
    await act(async () => {
      await screen.i18n.changeLanguage('es');
    });
    expect(screen.getByText('El anverso es obligatorio.')).toBeTruthy();
    expect(
      screen.getByPlaceholderText('La pregunta o el enunciado'),
    ).toBeTruthy();
  });
  it('requires both sides and does not submit without them', async () => {
    const onSubmit = jest.fn();
    const { getByText, getByPlaceholderText } = render(
      <CardForm title="New card" onSubmit={onSubmit} onCancel={jest.fn()} />,
    );
    fireEvent.changeText(
      getByPlaceholderText('The question or prompt'),
      'hola',
    );
    fireEvent.press(getByText('Save'));
    await waitFor(() => getByText('Back is required'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits trimmed values', async () => {
    const onSubmit = jest.fn(() => Promise.resolve());
    const { getByPlaceholderText, getByText } = render(
      <CardForm title="New card" onSubmit={onSubmit} onCancel={jest.fn()} />,
    );
    fireEvent.changeText(
      getByPlaceholderText('The question or prompt'),
      '  hola  ',
    );
    fireEvent.changeText(getByPlaceholderText('The answer'), ' hello ');
    fireEvent.press(getByText('Save'));
    await act(async () => {});
    expect(onSubmit).toHaveBeenCalledWith({ front: 'hola', back: 'hello' });
  });

  it('starts from the initial values when editing', () => {
    const { getByDisplayValue } = render(
      <CardForm
        title="Edit card"
        initialValues={{ front: 'hola', back: 'hello' }}
        onSubmit={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(getByDisplayValue('hola')).toBeTruthy();
    expect(getByDisplayValue('hello')).toBeTruthy();
  });
});
