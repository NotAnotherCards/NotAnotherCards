import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';

export interface ExplainableFinding {
  cardId: string;
  reason: string;
  classifier?: string;
}

export function useModerationExplanation(deckId: string) {
  const request = useRef<AbortController | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => () => request.current?.abort(), []);

  const explain = async (
    finding: ExplainableFinding,
    source: 'working' | 'published',
  ) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setActiveKey(`${source}:${finding.cardId}:${finding.reason}`);
    setText('');
    setError(null);
    setIsLoading(true);
    try {
      const explanation = await apiClient.publishing.explain(
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
