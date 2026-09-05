import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { DeckForm } from '../components/deck/DeckForm';
import { LANGUAGES } from '@repo/schemas';

// A deck's note type is chosen once, at creation. Its notes are compiled
// against it, so the edit form never offers the choice.

const onSubmit = vi.fn();
const onCancel = vi.fn();
const [english, spanish] = LANGUAGES;

beforeEach(() => {
  onSubmit.mockReset();
  onSubmit.mockResolvedValue(undefined);
  onCancel.mockReset();
});

const renderCreate = (defaults?: {
  nativeLanguageId: string | null;
  targetLanguageId: string | null;
}) =>
  render(
    <DeckForm
      title="Create New Deck"
      showNoteType
      defaultLanguages={defaults}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />,
  );

const chooseWords = () =>
  fireEvent.click(screen.getByRole('button', { name: /words/i }));

describe('DeckForm note type', () => {
  it('offers the choice when creating and not when editing', () => {
    const { unmount } = renderCreate();
    expect(screen.getByRole('button', { name: /words/i })).toBeTruthy();
    unmount();

    render(
      <DeckForm
        title="Edit Deck Details"
        initialData={{ title: 'Spanish', description: '' }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );
    expect(screen.queryByRole('button', { name: /words/i })).toBeNull();
  });

  it('defaults to cards, and a card deck carries no languages', async () => {
    renderCreate();
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Chemistry' },
    });
    // no language selects until Words is chosen
    expect(screen.queryByLabelText(/your language/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /save deck/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      noteType: 'basic',
      nativeLanguageId: null,
      targetLanguageId: null,
    });
  });

  it('prefills the profile pair for a word deck, and lets it be changed', async () => {
    renderCreate({
      nativeLanguageId: english.value,
      targetLanguageId: spanish.value,
    });
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Spanish' },
    });
    chooseWords();

    const target = screen.getByLabelText(/learning/i) as HTMLSelectElement;
    expect(target.value).toBe(spanish.value);
    // changeable: the deck's pair is not forced to match the profile
    fireEvent.change(target, { target: { value: english.value } });
    fireEvent.click(screen.getByRole('button', { name: /save deck/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      noteType: 'word',
      nativeLanguageId: english.value,
      targetLanguageId: english.value,
    });
  });

  it('will not create a word deck without both languages', async () => {
    // a profile that never finished onboarding leaves them unset
    renderCreate({ nativeLanguageId: null, targetLanguageId: null });
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Spanish' },
    });
    chooseWords();
    fireEvent.click(screen.getByRole('button', { name: /save deck/i }));

    await waitFor(() =>
      expect(screen.getAllByText(/needs both languages/i).length).toBe(2),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
