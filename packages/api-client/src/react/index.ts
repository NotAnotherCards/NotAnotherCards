import { useEffect, useRef, useState } from 'react';
import type { createApiClient } from '../client.js';

export interface ExplainableFinding {
  cardId: string;
  reason: string;
  classifier?: string;
}

export type ExplanationSource = 'working' | 'published';

type Client = Pick<ReturnType<typeof createApiClient>, 'publishing'>;

// One moderation explanation at a time, streamed in: the finding asked
// about last is the active one, its text grows as deltas arrive, and
// asking about another (or leaving) aborts the stream. The key is the
// caller's: whatever tells its findings apart on screen.
export function useModerationExplanation(client: Client, deckId: string) {
  const request = useRef<AbortController | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => () => request.current?.abort(), []);

  const explain = async (
    key: string,
    finding: ExplainableFinding,
    source: ExplanationSource,
  ) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setActiveKey(key);
    setText('');
    setError(null);
    setIsLoading(true);
    try {
      const explanation = await client.publishing.explain(
        deckId,
        { cardId: finding.cardId, reason: finding.reason, source },
        (delta) => {
          if (!controller.signal.aborted) setText((current) => current + delta);
        },
        { signal: controller.signal },
      );
      if (!controller.signal.aborted) setText(explanation);
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Request failed.');
      }
    } finally {
      if (request.current === controller) {
        request.current = null;
        setIsLoading(false);
      }
    }
  };

  return { activeKey, text, error, isLoading, explain };
}
