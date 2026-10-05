/** Decode SSE framing once; endpoint callbacks validate and identify the result. */
export async function readEventStream<T>(
  body: ReadableStream<Uint8Array>,
  options: {
    limitBytes: number;
    onEvent: (data: unknown) => T | undefined;
    signal?: AbortSignal;
    earlyCloseMessage?: string;
    sizeMessage?: string;
  },
): Promise<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let tail = '';
  let size = 0;
  const abort = () => {
    void reader.cancel().catch(() => undefined);
  };
  options.signal?.addEventListener('abort', abort, { once: true });
  try {
    for (;;) {
      if (options.signal?.aborted)
        throw new Error('The request was cancelled.');
      const { value, done } = await reader.read();
      if (done)
        throw new Error(
          options.earlyCloseMessage ??
            'The connection closed before the result arrived.',
        );
      size += value.byteLength;
      if (size > options.limitBytes)
        throw new Error(options.sizeMessage ?? 'The response is too large.');
      tail += decoder.decode(value, { stream: true });
      for (;;) {
        if (options.signal?.aborted)
          throw new Error('The request was cancelled.');
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
        const raw: unknown = JSON.parse(data);
        const result = options.onEvent(raw);
        if (result !== undefined) return result;
      }
    }
  } finally {
    options.signal?.removeEventListener('abort', abort);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
