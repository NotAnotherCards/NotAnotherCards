import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { CardEditor } from '@/components/card-editor';

const deck = {
  id: 'd1',
  title: 'Spanish',
  note_type: 'basic',
  native_language_id: null,
  target_language_id: null,
};
const card = {
  id: 'c1',
  note_id: 'n1',
  template_key: 'basic:front-back',
  active: true,
  front: 'gato',
  back: 'cat',
  due_at: 0,
  scheduled_interval_minutes: 0,
  created_at: 0,
  updated_at: 0,
};
const note = { id: 'n1', note_type: 'basic' };

describe('CardEditor', () => {
  it('takes no save while a delete is running', async () => {
    const writes = {
      update: jest.fn(() => Promise.resolve()),
      // never settles: the delete is still on its way
      deleteNote: jest.fn(() => new Promise<void>(() => {})),
    };
    const result = render(
      <CardEditor
        deck={deck as never}
        card={card as never}
        note={note as never}
        writes={writes as never}
        onDone={jest.fn()}
      />,
    );

    fireEvent.press(result.getByLabelText('Delete card'));
    fireEvent.press(result.getByText('Delete'));
    await waitFor(() => expect(writes.deleteNote).toHaveBeenCalledTimes(1));

    const save = result.getByRole('button', { name: 'Save' });
    expect(save.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(save);
    // give a submit the time it would need to reach the write
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(writes.update).not.toHaveBeenCalled();
  });
});
