import {
  useModerationExplanation as useSharedModerationExplanation,
  type ExplainableFinding,
} from '@repo/api-client/react';
import { apiClient } from '@/lib/api-client';

export type { ExplainableFinding };

// The shared hook over this app's client; see @repo/api-client/react.
export function useModerationExplanation(deckId: string) {
  return useSharedModerationExplanation(apiClient, deckId);
}
