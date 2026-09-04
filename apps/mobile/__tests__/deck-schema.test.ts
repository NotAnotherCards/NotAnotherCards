import { deckFormSchema } from '@/lib/deck-schema';

// The limits web's DeckForm enforces, plus the trim-before-check that web
// lacks: a whitespace-only title is rejected here, not saved as empty.
describe('deckFormSchema', () => {
  it('trims and accepts a title with an empty description', () => {
    expect(
      deckFormSchema.parse({ title: '  Spanish  ', description: '' }),
    ).toEqual({
      title: 'Spanish',
      description: '',
    });
  });

  it('rejects a whitespace-only title', () => {
    expect(
      deckFormSchema.safeParse({ title: '   ', description: '' }).success,
    ).toBe(false);
  });

  it('enforces both length limits', () => {
    expect(
      deckFormSchema.safeParse({
        title: 'a'.repeat(100),
        description: 'b'.repeat(500),
      }).success,
    ).toBe(true);
    expect(
      deckFormSchema.safeParse({ title: 'a'.repeat(101), description: '' })
        .success,
    ).toBe(false);
    expect(
      deckFormSchema.safeParse({ title: 'ok', description: 'b'.repeat(501) })
        .success,
    ).toBe(false);
  });
});
