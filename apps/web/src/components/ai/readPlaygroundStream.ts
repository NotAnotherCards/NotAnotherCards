import { aiPlaygroundEventSchema, type AiCardOutput } from '@repo/schemas';

/** Read application events; only a validated result makes the run successful. */
export async function readPlaygroundStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (delta: string) => void,
): Promise<AiCardOutput[]> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let tail = '';
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done)
        throw new Error(
          'Creation connection closed before the result arrived.',
        );
      size += value.byteLength;
      if (size > 2_000_000)
        throw new Error('Creation response is too large.');
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
        const parsed = aiPlaygroundEventSchema.safeParse(JSON.parse(data));
        if (!parsed.success) throw new Error('Invalid creation response.');
        switch (parsed.data.type) {
          case 'delta':
            onDelta(parsed.data.delta);
            break;
          case 'result':
            return parsed.data.cards;
          case 'error':
            throw new Error(parsed.data.message);
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
