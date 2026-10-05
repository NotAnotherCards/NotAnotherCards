import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActivateMoreWords } from '@/components/review/ReviewDialogs';

describe('ActivateMoreWords', () => {
  it('keeps raw input while editing and clamps it only when activating', async () => {
    const onActivate = vi.fn().mockResolvedValue(undefined);

    render(
      <ActivateMoreWords
        initialCount={50}
        inactiveItemCount={1}
        itemLabel="cards"
        onActivate={onActivate}
        onExit={vi.fn()}
      />,
    );

    const input = screen.getByLabelText('Activate');
    expect(input).toHaveValue(1);

    fireEvent.change(input, { target: { value: '50' } });
    expect(input).toHaveValue(50);
    fireEvent.click(
      screen.getByRole('button', { name: 'Activate and continue' }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(onActivate).toHaveBeenCalledWith(1);
  });

  it('allows clearing the count before entering a replacement value', async () => {
    const onActivate = vi.fn().mockResolvedValue(undefined);

    render(
      <ActivateMoreWords
        initialCount={5}
        inactiveItemCount={10}
        itemLabel="words"
        onActivate={onActivate}
        onExit={vi.fn()}
      />,
    );

    const input = screen.getByLabelText('Activate');
    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveValue(null);
    fireEvent.change(input, { target: { value: '3' } });
    expect(input).toHaveValue(3);
    fireEvent.click(
      screen.getByRole('button', { name: 'Activate and continue' }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(onActivate).toHaveBeenCalledWith(3);
  });
});
