import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from './client.js';
import { ApiTimeoutError } from './transport.js';

afterEach(() => vi.useRealTimers());
const job = {
  id: 'j/1',
  type: 'topic_deck',
  status: 'pending',
  payload: { topic: 'Words', count: 2 },
  createdAt: '2026-01-01',
};
const input = { type: 'topic_deck' as const, topic: 'Words', count: 2 };
const setup = (body: unknown) => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementation(async () => new Response(JSON.stringify(body)));
  return { fetch, ai: createApiClient({ baseUrl: '', fetch }).ai };
};
describe('AI endpoints', () => {
  it('generates once with the supplied input and returns a parsed job', async () => {
    const { fetch, ai } = setup({ job });
    expect(await ai.generate(input)).toEqual({ job });
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      '/api/ai/generate',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });
  it('fetches a job with an encoded id', async () => {
    const { fetch, ai } = setup({ job });
    expect(await ai.job('j/1')).toEqual({ job });
    expect(fetch).toHaveBeenCalledWith('/api/ai/jobs/j%2F1', expect.anything());
  });
  it('lists known job shapes and skips future shapes through the shared schema', async () => {
    const { fetch, ai } = setup({ jobs: [job, { type: 'future' }] });
    expect(await ai.jobs()).toEqual({ jobs: [job] });
    expect(fetch).toHaveBeenCalledWith('/api/ai/jobs', expect.anything());
  });
  it('reads quota', async () => {
    const quota = {
      usedTokens: 0,
      maxTokens: 100,
      requestsUsed: 0,
      maxRequests: 5,
      activePendingJobs: 0,
      maxPendingJobs: 2,
    };
    const { fetch, ai } = setup({ quota });
    expect(await ai.quota()).toEqual({ quota });
    expect(fetch).toHaveBeenCalledWith('/api/ai/quota', expect.anything());
  });
  it('validates job and quota results', async () => {
    await expect(
      setup({ job: { ...job, status: 'nonsense' } }).ai.job('j'),
    ).rejects.toThrow();
    await expect(setup({ quota: {} }).ai.quota()).rejects.toThrow();
  });
  it('delivers validated stream events and returns cards', async () => {
    const cards = [{ front: 'a', back: 'b' }];
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        new Response(
          'data: {"type":"delta","delta":"partial"}\n\ndata: ' +
            JSON.stringify({ type: 'result', cards }) +
            '\n\n',
        ),
      );
    const onEvent = vi.fn();
    expect(
      await createApiClient({ baseUrl: '', fetch }).ai.playgroundStream(
        input,
        onEvent,
      ),
    ).toEqual(cards);
    expect(onEvent).toHaveBeenNthCalledWith(1, {
      type: 'delta',
      delta: 'partial',
    });
    expect(onEvent).toHaveBeenNthCalledWith(2, { type: 'result', cards });
    expect(fetch).toHaveBeenCalledWith(
      '/api/ai/playground/stream',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });
  it.each([
    'data: {"type":"error","message":"No"}\n\n',
    'data: {"type":"result","cards":[42]}\n\n',
    'data: {"type":"delta","delta":"partial"}\n\n',
  ])('rejects error, invalid result and early close', async (wire) => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(wire));
    await expect(
      createApiClient({ baseUrl: '', fetch }).ai.playgroundStream(
        input,
        () => {},
      ),
    ).rejects.toThrow();
  });
  it('limits playground streams to 2 MB', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response('x'.repeat(2_000_001)));
    await expect(
      createApiClient({ baseUrl: '', fetch }).ai.playgroundStream(
        input,
        () => {},
      ),
    ).rejects.toThrow('too large');
  });
  it('uses the 60 s stream deadline and cancels the reader', async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(new ReadableStream({ cancel })));
    const pending = createApiClient({ baseUrl: '', fetch }).ai.playgroundStream(
      input,
      () => {},
    );
    const check = expect(pending).rejects.toBeInstanceOf(ApiTimeoutError);
    await vi.advanceTimersByTimeAsync(60_000);
    await check;
    expect(cancel).toHaveBeenCalled();
  });
  it('passes caller cancellation to streamed requests', async () => {
    const controller = new AbortController();
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(new ReadableStream()));
    const pending = createApiClient({ baseUrl: '', fetch }).ai.playgroundStream(
      input,
      () => {},
      { signal: controller.signal },
    );
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
