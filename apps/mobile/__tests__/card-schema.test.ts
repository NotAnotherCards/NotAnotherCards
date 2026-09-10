import { cardFormSchema } from '@/lib/card-schema';
import { CARD_FACE_MAX_LENGTH } from '@repo/schemas';

describe('cardFormSchema', () => {
  it('trims both sides and accepts them', () => {
    expect(
      cardFormSchema.parse({ front: '  hola  ', back: ' hello ' }),
    ).toEqual({
      front: 'hola',
      back: 'hello',
    });
  });

  it('rejects a whitespace-only front or back', () => {
    expect(
      cardFormSchema.safeParse({ front: '   ', back: 'hello' }).success,
    ).toBe(false);
    expect(
      cardFormSchema.safeParse({ front: 'hola', back: '   ' }).success,
    ).toBe(false);
  });

  it('enforces the review-safe limit on each side', () => {
    const max = 'a'.repeat(CARD_FACE_MAX_LENGTH);
    expect(cardFormSchema.safeParse({ front: max, back: max }).success).toBe(
      true,
    );
    expect(
      cardFormSchema.safeParse({ front: max + 'a', back: 'x' }).success,
    ).toBe(false);
    expect(
      cardFormSchema.safeParse({ front: 'x', back: max + 'a' }).success,
    ).toBe(false);
  });
});
