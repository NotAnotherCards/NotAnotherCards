import { cardFormSchema } from '@/lib/card-schema';

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

  it('enforces the 1000-character limit on each side', () => {
    const max = 'a'.repeat(1000);
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
