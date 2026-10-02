import { ApiError } from '@repo/api-client';

export function aiErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) {
    const body = error.body;
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === 'AI_ACTIVE_JOB_LIMIT')
        return 'Too many generations are running. Try again in a moment.';
      if (body.code === 'AI_DAILY_QUOTA')
        return 'Your AI quota is used up for today.';
    }
  }
  return error instanceof Error
    ? error.message
    : 'Generation failed. Try again.';
}
