import { useEffect, useRef, useState } from 'react';
import { moderationExplanationEventSchema } from '@repo/schemas';

export interface ExplainableFinding {
  cardId: string;
  reason: string;
  classifier?: string;
}

async function readExplanationStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (delta: string) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let tail = '';
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) throw new Error('The explanation connection closed early.');
      size += value.byteLength;
      if (size > 100_000) throw new Error('The explanation is too large.');
      tail += decoder.decode(value, { stream: true });
      for (;;) {
        const boundary = /\r?\n\r?\n/.exec(tail);
        if (!boundary) break;
        const event = tail.slice(0, boundary.index);
        tail = tail.slice(boundary.index + boundary[0].length);
        const data = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).replace(/^ /, ''))
          .join('\n');
        if (!data) continue;
        const parsed = moderationExplanationEventSchema.safeParse(
          JSON.parse(data),
        );
        if (!parsed.success) throw new Error('Invalid explanation response.');
        if (parsed.data.type === 'delta') onDelta(parsed.data.delta);
        if (parsed.data.type === 'result') return parsed.data.explanation;
        if (parsed.data.type === 'error') throw new Error(parsed.data.message);
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
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
      const res = await fetch(
        `/api/decks/${encodeURIComponent(deckId)}/moderation/explain`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...finding, source }),
          signal: controller.signal,
        },
      );
      if (!res.ok) throw new Error('The explanation could not be requested.');
      if (!res.body) throw new Error('The explanation has no response stream.');
      const explanation = await readExplanationStream(res.body, (delta) => {
        if (!controller.signal.aborted) {
          setText((current) => current + delta);
        }
      });
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
