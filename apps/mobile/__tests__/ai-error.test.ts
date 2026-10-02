import { ApiError } from '@repo/api-client';
import { aiErrorMessage } from '@/lib/ai-error';

it.each([
  [
    'AI_ACTIVE_JOB_LIMIT',
    'Too many generations are running. Try again in a moment.',
  ],
  ['AI_DAILY_QUOTA', 'Your AI quota is used up for today.'],
])('maps 429 code %s without depending on English text', (code, expected) => {
  expect(
    aiErrorMessage(
      new ApiError('arbitrary server text', 429, {
        statusCode: 429,
        code,
        message: 'arbitrary server text',
      }),
    ),
  ).toBe(expected);
});

it.each([
  undefined,
  null,
  'legacy response',
  { code: 'UNKNOWN_LIMIT' },
  { message: 'Active generation cap reached.' },
])('keeps the server message for an unrecognized 429 body: %s', (body) => {
  expect(
    aiErrorMessage(new ApiError('Please wait and try again.', 429, body)),
  ).toBe('Please wait and try again.');
});

it('does not mislabel another HTTP failure as quota', () => {
  expect(
    aiErrorMessage(
      new ApiError('Server unavailable', 503, { code: 'AI_DAILY_QUOTA' }),
    ),
  ).toBe('Server unavailable');
});
