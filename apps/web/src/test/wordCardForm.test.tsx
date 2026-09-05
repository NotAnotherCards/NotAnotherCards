import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { WordCardForm } from '../components/deck/WordCardForm';
import { ENGLISH, GERMAN, RUSSIAN, SPANISH } from '@repo/schemas';

// The form owns the fields a person types. Languages are the deck's and the
// two media ids are file references, so neither appears here — see
// DeckDetail for where the deck's pair is merged in.

const onSubmit = vi.fn();
const onCancel = vi.fn();

const fill = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  onSubmit.mockReset();
  onSubmit.mockResolvedValue(undefined);
  onCancel.mockReset();
});

const renderForm = (initialData?: Record<string, string>) =>
  render(
    <WordCardForm
      title="Add New Word"
      onSubmit={onSubmit}
      onCancel={onCancel}
      initialData={initialData}
    />,
  );

describe('WordCardForm', () => {
  it('asks for the word and its translation, and nothing else up front', () => {
    renderForm();
    expect(screen.getByLabelText(/^word$/i)).toBeTruthy();
    expect(screen.getByLabelText(/translation/i)).toBeTruthy();
    // the optional fields stay behind the disclosure
    expect(screen.queryByLabelText(/part of speech/i)).toBeNull();
    // languages belong to the deck, never to this form
    expect(screen.queryByLabelText(/language/i)).toBeNull();
  });

  it('will not submit without a word or a translation', async () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(onSubmit).not.toHaveBeenCalled());
  });

  it('submits only the fields that were filled in', async () => {
    renderForm();
    fill(/^word$/i, '  laufen  ');
    fill(/translation/i, 'to run');
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    // blank optionals are dropped, not sent as '', which the registry
    // rejects as a present-but-empty field
    expect(onSubmit.mock.calls[0][0]).toEqual({
      word: 'laufen',
      translation: 'to run',
    });
  });

  it('carries the optional fields when they are filled', async () => {
    renderForm();
    fill(/^word$/i, 'laufen');
    fill(/translation/i, 'to run');
    fireEvent.click(screen.getByRole('button', { name: /more details/i }));
    fill(/part of speech/i, 'verb');
    fill(/pronunciation/i, 'ˈlaʊ̯fn̩');
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      word: 'laufen',
      translation: 'to run',
      part_of_speech: 'verb',
      pronunciation: 'ˈlaʊ̯fn̩',
    });
  });

  it('opens the details already expanded when the note uses any of them', () => {
    renderForm({
      word: 'laufen',
      translation: 'to run',
      example: 'er läuft',
    });
    // otherwise an edit would hide the very field being edited
    expect(screen.getByLabelText(/^example$/i)).toBeTruthy();
    expect(
      (screen.getByLabelText(/^example$/i) as HTMLInputElement).value,
    ).toBe('er läuft');
  });

  it('clearing an optional field removes it rather than blanking it', async () => {
    renderForm({ word: 'laufen', translation: 'to run', notes: 'irregular' });
    fill(/notes/i, '');
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      word: 'laufen',
      translation: 'to run',
    });
  });
});

// Gender is a property of the language, not of the form. German and Spanish
// take the definite article, Russian has genders but no articles, and
// English has no grammatical gender at all.
describe('WordCardForm gender', () => {
  const openDetails = () =>
    fireEvent.click(screen.getByRole('button', { name: /more details/i }));

  const optionsFor = (targetLanguageId: string) => {
    render(
      <WordCardForm
        title="Add New Word"
        targetLanguageId={targetLanguageId}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );
    openDetails();
    const select = screen.queryByLabelText(/gender/i);
    return select
      ? Array.from((select as HTMLSelectElement).options)
          .map((option) => option.value)
          .filter(Boolean)
      : null;
  };

  it('offers the definite articles for German', () => {
    expect(optionsFor(GERMAN)).toEqual(['der', 'die', 'das']);
  });

  it('offers the definite articles for Spanish', () => {
    expect(optionsFor(SPANISH)).toEqual(['el', 'la']);
  });

  it('offers the dictionary abbreviations for Russian, which has no articles', () => {
    expect(optionsFor(RUSSIAN)).toEqual(['м.', 'ж.', 'ср.']);
  });

  it('does not ask at all for a language without grammatical gender', () => {
    expect(optionsFor(ENGLISH)).toBeNull();
  });

  it('does not ask when the deck has no target language', () => {
    render(
      <WordCardForm
        title="Add New Word"
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );
    openDetails();
    expect(screen.queryByLabelText(/gender/i)).toBeNull();
  });

  it('submits the chosen gender', async () => {
    render(
      <WordCardForm
        title="Add New Word"
        targetLanguageId={GERMAN}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );
    fill(/^word$/i, 'Hund');
    fill(/translation/i, 'dog');
    openDetails();
    fireEvent.change(screen.getByLabelText(/gender/i), {
      target: { value: 'der' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      word: 'Hund',
      translation: 'dog',
      gender: 'der',
    });
  });
});
