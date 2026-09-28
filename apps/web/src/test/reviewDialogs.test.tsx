import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActivateMoreWords } from '@/components/review/ReviewDialogs';

describe('ActivateMoreWords', () => {
  it('never offers to activate more items than remain in the deck', async () => {
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
    expect(input).toHaveValue(1);
    fireEvent.click(
      screen.getByRole('button', { name: 'Activate and continue' }),
    );

    expect(onActivate).toHaveBeenCalledWith(1);
  });
});
