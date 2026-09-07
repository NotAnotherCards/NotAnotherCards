import { deckFormSchema } from '@/lib/deck-schema';

const basicDeck = {
  noteType: 'basic',
  nativeLanguageId: '',
  targetLanguageId: '',
} as const;

// The limits web's DeckForm enforces, plus the trim-before-check that web
// lacks: a whitespace-only title is rejected here, not saved as empty.
describe('deckFormSchema', () => {
  it('trims and accepts a title with an empty description', () => {
    expect(
      deckFormSchema.parse({
        title: '  Spanish  ',
        description: '',
        ...basicDeck,
      }),
    ).toEqual({
      title: 'Spanish',
      description: '',
      ...basicDeck,
    });
  });

  it('rejects a whitespace-only title', () => {
    expect(
      deckFormSchema.safeParse({
        title: '   ',
        description: '',
        ...basicDeck,
      }).success,
    ).toBe(false);
  });

  it('enforces both length limits', () => {
    expect(
      deckFormSchema.safeParse({
        title: 'a'.repeat(100),
        description: 'b'.repeat(500),
        ...basicDeck,
      }).success,
    ).toBe(true);
    expect(
      deckFormSchema.safeParse({
        title: 'a'.repeat(101),
        description: '',
        ...basicDeck,
      }).success,
    ).toBe(false);
    expect(
      deckFormSchema.safeParse({
        title: 'ok',
        description: 'b'.repeat(501),
        ...basicDeck,
      }).success,
    ).toBe(false);
  });

  it('requires two different languages for a word deck', () => {
    expect(
      deckFormSchema.safeParse({
        title: 'Words',
        description: '',
        noteType: 'word',
        nativeLanguageId: '',
        targetLanguageId: '',
      }).success,
    ).toBe(false);
    expect(
      deckFormSchema.safeParse({
        title: 'Words',
        description: '',
        noteType: 'word',
        nativeLanguageId: 'en',
        targetLanguageId: 'en',
      }).success,
    ).toBe(false);
  });
});
