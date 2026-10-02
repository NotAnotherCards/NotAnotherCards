import { t } from 'i18next';
import { ApiError } from '@repo/api-client';

export function aiErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) {
    const body = error.body;
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === 'AI_ACTIVE_JOB_LIMIT')
        return t('mobile.messages.ai_busy');
      if (body.code === 'AI_DAILY_QUOTA') return t('mobile.messages.ai_quota');
    }
  }
  return error instanceof Error
    ? error.message
    : t('mobile.messages.ai_failed');
}
