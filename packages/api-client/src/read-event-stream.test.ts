import { describe, expect, it, vi } from 'vitest';
import { readEventStream } from './read-event-stream.js';
import { moderationExplanationEventSchema } from '@repo/schemas';

const onEvent = (raw: unknown) => {
  const event = moderationExplanationEventSchema.parse(raw);
  if (event.type === 'error') throw new Error(event.message);
  if (event.type === 'result') return event.explanation;
};
describe('SSE reader', () => {
  it('stops dispatching buffered events when a callback cancels', async () => {
    const controller = new AbortController();
    const receive = vi.fn(() => {
      controller.abort();
    });
    const body = new Response('data: 1\n\ndata: 2\n\n').body!;
    await expect(
      readEventStream(body, {
        limitBytes: 100,
        signal: controller.signal,
        onEvent: receive,
      }),
    ).rejects.toThrow('cancelled');
    expect(receive).toHaveBeenCalledTimes(1);
    expect(body.locked).toBe(false);
  });
  it('handles fragmented UTF-8, CRLF, comments and multiline data, then cancels and releases', async () => {
    const bytes = new TextEncoder().encode(
      ': ping\r\n\r\ndata: {"type":"result",\r\ndata: "explanation":"café"}\r\n\r\n',
    );
    const cut = bytes.indexOf(0xc3) + 1;
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, cut));
        controller.enqueue(bytes.slice(cut));
      },
      cancel,
    });
    await expect(
      readEventStream(body, { limitBytes: 1000, onEvent }),
    ).resolves.toBe('café');
    expect(cancel).toHaveBeenCalled();
    expect(body.locked).toBe(false);
  });
  it.each([
    'data: nope\n\n',
    'data: {"type":"wrong"}\n\n',
    'data: {"type":"error","message":"No"}\n\n',
    'data: {"type":"delta","delta":"partial"}\n\n',
  ])('rejects malformed events, errors and early close: %s', async (wire) => {
    const body = new Response(wire).body!;
    await expect(
      readEventStream(body, { limitBytes: 1000, onEvent }),
    ).rejects.toThrow();
    expect(body.locked).toBe(false);
  });
  it('enforces byte limits', async () => {
    await expect(
      readEventStream(new Response('ééé').body!, { limitBytes: 5, onEvent }),
    ).rejects.toThrow('too large');
  });
  it('cancels a stalled reader on abort', async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const pending = readEventStream(body, {
      limitBytes: 10,
      onEvent,
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toThrow();
    expect(cancel).toHaveBeenCalled();
    expect(body.locked).toBe(false);
  });
});
