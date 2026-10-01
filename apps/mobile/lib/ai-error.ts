import { ApiError } from '@repo/api-client';

export function aiErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 429)
    return 'Your AI quota is used up for today.';
  return error instanceof Error
    ? error.message
    : 'Generation failed. Try again.';
}
