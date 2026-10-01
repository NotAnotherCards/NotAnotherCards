import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ApiTimeoutError, createRequest } from './transport.js';

afterEach(() => vi.useRealTimers());
const text = (response: Response) => response.text();

describe('request transport', () => {
  it('reads headers and the default fetch per request', async () => {
    const headers = vi
      .fn()
      .mockReturnValueOnce({ cookie: 'first' })
      .mockReturnValueOnce({ cookie: 'second' });
    const request = createRequest({
      baseUrl: 'https://example.test/',
      headers,
    });
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response('ok'));
    try {
      await request('/api/a', {}, text);
      await request('/api/b', { method: 'POST', body: '{}' }, text);
      expect(fetch).toHaveBeenNthCalledWith(
        1,
        'https://example.test/api/a',
        expect.objectContaining({ headers: { cookie: 'first' } }),
      );
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        'https://example.test/api/b',
        expect.objectContaining({
          headers: { cookie: 'second', 'Content-Type': 'application/json' },
        }),
      );
    } finally {
      fetch.mockRestore();
    }
  });

  it('keeps status and body for server failures and does not retry writes', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify({ message: 'No', detail: 1 }), {
        status: 422,
      }),
    );
    const request = createRequest({ baseUrl: '', fetch });
    await expect(
      request('/api/write', { method: 'POST' }, text),
    ).rejects.toMatchObject({
      message: 'No',
      status: 422,
      body: { message: 'No', detail: 1 },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('uses status text for non-JSON failures and wraps network failures without status', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response('html', { status: 503, statusText: 'Unavailable' }),
      )
      .mockRejectedValueOnce(new TypeError('Offline'));
    const request = createRequest({ baseUrl: '', fetch });
    await expect(request('/a', {}, text)).rejects.toMatchObject({
      message: 'Unavailable',
      status: 503,
      body: null,
    });
    await expect(request('/b', {}, text)).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Offline',
      status: undefined,
    });
  });

  it('times out while reading the body, not just waiting for headers', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    const fetch: typeof globalThis.fetch = async (_, init) => {
      signal = init?.signal;
      return new Response(new ReadableStream());
    };
    const pending = createRequest({ baseUrl: '', fetch })('/a', {}, text, {
      timeoutMs: 20,
    });
    const check = expect(pending).rejects.toBeInstanceOf(ApiTimeoutError);
    await vi.advanceTimersByTimeAsync(20);
    await check;
    expect(signal?.aborted).toBe(true);
  });

  it('preserves caller cancellation, including an already aborted signal', async () => {
    const controller = new AbortController();
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementation(() => new Promise(() => {}));
    const request = createRequest({ baseUrl: '', fetch });
    const pending = request('/a', {}, text, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({
      name: 'AbortError',
      status: undefined,
    });
    await expect(
      request('/b', {}, text, { signal: controller.signal }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
