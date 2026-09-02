import { useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CardForm } from '../components/deck/CardForm';
import { DeckForm } from '../components/deck/DeckForm';

function CardFormTestWrapper() {
  const [renderCount, setRenderCount] = useState(0);
  const card = { front: 'Original Front', back: 'Original Back' };

  return (
    <div>
      <button
        data-testid="force-rerender"
        onClick={() => setRenderCount((c) => c + 1)}
      >
        Rerender Count: {renderCount}
      </button>
      <CardForm
        title="Edit Card"
        initialData={{
          front: card.front,
          back: card.back,
        }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    </div>
  );
}

function DeckFormTestWrapper() {
  const [renderCount, setRenderCount] = useState(0);
  const deck = {
    title: 'Original Deck Title',
    description: 'Original Description',
  };

  return (
    <div>
      <button
        data-testid="force-rerender"
        onClick={() => setRenderCount((c) => c + 1)}
      >
        Rerender Count: {renderCount}
      </button>
      <DeckForm
        title="Edit Deck"
        initialData={{
          title: deck.title,
          description: deck.description,
        }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    </div>
  );
}

describe('Form Edit Input Persistence Across Parent Re-renders', () => {
  it('retains typed text in CardForm front and back inputs when parent re-renders with a new initialData object reference', async () => {
    render(<CardFormTestWrapper />);

    const frontInput = screen.getByLabelText(/front/i) as HTMLTextAreaElement;
    const backInput = screen.getByLabelText(/back/i) as HTMLTextAreaElement;

    expect(frontInput.value).toBe('Original Front');
    expect(backInput.value).toBe('Original Back');

    // Type modifications into front and back fields
    fireEvent.change(frontInput, {
      target: { value: 'Original Front - modified while typing' },
    });
    fireEvent.change(backInput, {
      target: { value: 'Original Back - modified while typing' },
    });

    expect(frontInput.value).toBe('Original Front - modified while typing');
    expect(backInput.value).toBe('Original Back - modified while typing');

    // Force parent re-render (e.g. store 10s setTimeTrigger re-render)
    await act(async () => {
      fireEvent.click(screen.getByTestId('force-rerender'));
    });

    // Verify typed inputs are preserved and not wiped out by initialData prop reset
    expect(frontInput.value).toBe('Original Front - modified while typing');
    expect(backInput.value).toBe('Original Back - modified while typing');
  });

  it('retains typed text in DeckForm title and description inputs when parent re-renders with a new initialData object reference', async () => {
    render(<DeckFormTestWrapper />);

    const titleInput = screen.getByLabelText(/deck title/i) as HTMLInputElement;
    const descInput = screen.getByLabelText(
      /description/i,
    ) as HTMLTextAreaElement;

    expect(titleInput.value).toBe('Original Deck Title');
    expect(descInput.value).toBe('Original Description');

    // Type modifications into title and description fields
    fireEvent.change(titleInput, { target: { value: 'New Typed Deck Title' } });
    fireEvent.change(descInput, { target: { value: 'New Typed Description' } });

    expect(titleInput.value).toBe('New Typed Deck Title');
    expect(descInput.value).toBe('New Typed Description');

    // Force parent re-render (e.g. store 10s setTimeTrigger re-render)
    await act(async () => {
      fireEvent.click(screen.getByTestId('force-rerender'));
    });

    // Verify typed inputs are preserved and not wiped out by initialData prop reset
    expect(titleInput.value).toBe('New Typed Deck Title');
    expect(descInput.value).toBe('New Typed Description');
  });
});
