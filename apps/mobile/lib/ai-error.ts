import { ApiError } from '@repo/api-client';
import { UiError, toUiError } from './errors';

export function aiErrorMessage(error: unknown): UiError {
  if (error instanceof ApiError && error.status === 429) {
    const body = error.body;
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === 'AI_ACTIVE_JOB_LIMIT')
        return new UiError('mobile.messages.ai_busy');
      if (body.code === 'AI_DAILY_QUOTA')
        return new UiError('mobile.messages.ai_quota');
    }
  }
  return toUiError(error);
}
