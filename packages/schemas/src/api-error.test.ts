import { describe, expect, it } from 'vitest';
import { apiErrorBodySchema } from './api-error.js';

describe('apiErrorBodySchema', () => {
  it('extracts a string message', () => {
    expect(apiErrorBodySchema.parse({ message: 'Username taken' })).toEqual({
      message: 'Username taken',
    });
  });

  it.each([
    ['null body', null],
    ['string body', 'Internal Server Error'],
    ['array body', []],
    ['non-string message', { message: 42 }],
    ['undefined', undefined],
  ])('parses %s to an empty object instead of throwing', (_name, body) => {
    expect(apiErrorBodySchema.parse(body)).toEqual({});
  });

  it('drops fields the clients do not read', () => {
    expect(
      apiErrorBodySchema.parse({
        message: 'no',
        statusCode: 400,
        error: 'Bad',
      }),
    ).toEqual({ message: 'no' });
  });
});
