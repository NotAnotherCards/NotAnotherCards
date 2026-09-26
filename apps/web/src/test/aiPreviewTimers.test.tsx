import { StrictMode } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiResultPreview } from '@/components/ai/AiResultPreview';
import { AiWordNotePreview } from '@/components/ai/AiWordNotePreview';

const previews = [
  {
    name: 'cards',
    button: 'Save Cards to Deck',
    message: 'Deck Saved!',
    render: (onSave: () => Promise<void>) => (
      <AiResultPreview
        cards={[{ front: 'Haus', back: 'house' }]}
        decks={[{ id: 'deck-1', title: 'German' }]}
        onSave={onSave}
        isSaving={false}
      />
    ),
  },
  {
    name: 'word note',
    button: 'Save Note to Deck',
    message: 'Note Saved!',
    render: (onSave: () => Promise<void>) => (
      <AiWordNotePreview
        note={{
          noteType: 'word',
          fieldsVersion: 1,
          fields: {
            word: 'Haus',
            translation: 'house',
            native_language_id: 'en',
            target_language_id: 'de',
            part_of_speech: 'noun',
            pronunciation: 'haʊs',
            example: 'Das Haus ist groß.',
            example_translation: 'The house is big.',
          },
        }}
        deckName="German"
        onSave={onSave}
        isSaving={false}
      />
    ),
  },
];

describe.each(previews)('$name preview timer', (preview) => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  async function save() {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: preview.button }));
    });
  }

  it('cancels the confirmation timer on unmount after saving', async () => {
    const view = render(
      <StrictMode>
        {preview.render(vi.fn().mockResolvedValue(undefined))}
      </StrictMode>,
    );
    await save();
    expect(screen.getByText(preview.message)).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not schedule a timer when saving completes after unmount', async () => {
    let finish!: () => void;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const view = render(preview.render(onSave));
    await save();
    expect(onSave).toHaveBeenCalledOnce();
    view.unmount();
    await act(async () => {
      finish();
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('replaces the previous timer and shows each confirmation for three seconds', async () => {
    render(preview.render(vi.fn().mockResolvedValue(undefined)));
    await save();
    await act(() => vi.advanceTimersByTime(2000));
    await save();
    expect(vi.getTimerCount()).toBe(1);
    await act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText(preview.message)).toBeInTheDocument();
    await act(() => vi.advanceTimersByTime(1999));
    expect(screen.getByText(preview.message)).toBeInTheDocument();
    await act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText(preview.message)).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });
});
