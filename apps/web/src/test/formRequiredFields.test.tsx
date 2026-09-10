import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CardForm, cardSchema } from '../components/deck/CardForm';
import { DeckForm } from '../components/deck/DeckForm';
import { CARD_FACE_MAX_LENGTH } from '@repo/schemas';

describe('Required deck and card fields', () => {
  it('limits card faces to the review-safe content length', () => {
    expect(
      cardSchema.safeParse({
        front: 'f'.repeat(CARD_FACE_MAX_LENGTH),
        back: 'b'.repeat(CARD_FACE_MAX_LENGTH),
      }).success,
    ).toBe(true);

    const result = cardSchema.safeParse({
      front: 'f'.repeat(CARD_FACE_MAX_LENGTH + 1),
      back: 'b'.repeat(CARD_FACE_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toEqual({
        front: [`Content cannot exceed ${CARD_FACE_MAX_LENGTH} characters`],
        back: [`Content cannot exceed ${CARD_FACE_MAX_LENGTH} characters`],
      });
    }
  });

  it('rejects a whitespace-only deck title and accepts a corrected title', async () => {
    const onSubmit = vi.fn();
    render(
      <DeckForm title="Create Deck" onSubmit={onSubmit} onCancel={vi.fn()} />,
    );
    const title = screen.getByLabelText(/deck title/i);
    fireEvent.change(title, { target: { value: ' \t ' } });
    fireEvent.click(screen.getByRole('button', { name: /save deck/i }));

    expect(await screen.findByText('Deck title is required')).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(title, { target: { value: ' Travel vocabulary ' } });
    fireEvent.click(screen.getByRole('button', { name: /save deck/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      title: 'Travel vocabulary',
    });
  });

  it.each(['front', 'back'] as const)(
    'rejects whitespace-only card %s content and accepts a correction',
    async (field) => {
      const onSubmit = vi.fn();
      const initialData = { front: 'Question', back: 'Answer' };
      render(
        <CardForm
          title="Edit Card"
          initialData={initialData}
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        />,
      );
      const input = screen.getByLabelText(new RegExp(field, 'i'));
      fireEvent.change(input, { target: { value: ' \n\t ' } });
      fireEvent.click(screen.getByRole('button', { name: /save card/i }));

      const message =
        field === 'front'
          ? 'Front content is required'
          : 'Back content is required';
      expect(await screen.findByText(message)).toBeVisible();
      expect(onSubmit).not.toHaveBeenCalled();

      fireEvent.change(input, { target: { value: ` ${initialData[field]} ` } });
      fireEvent.click(screen.getByRole('button', { name: /save card/i }));
      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledExactlyOnceWith(initialData),
      );
    },
  );
});
