import { apiErrorBodySchema } from '@repo/schemas';

export interface ApiTransport {
  baseUrl: string;
  headers?: () => Record<string, string>;
  fetch?: typeof fetch;
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiTimeoutError extends ApiError {
  constructor() {
    super('The server did not answer in time. Try again.');
    this.name = 'ApiTimeoutError';
  }
}

/** Own the deadline until the response body (including a stream) is consumed. */
export function createRequest(transport: ApiTransport) {
  return async function request<T>(
    path: string,
    init: RequestInit,
    consume: (response: Response, signal: AbortSignal) => Promise<T>,
    options: RequestOptions = {},
  ): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort(options.signal?.reason);
    const aborted = () => {
      if (timedOut) return new ApiTimeoutError();
      const error = new ApiError('The request was cancelled.');
      error.name = 'AbortError';
      return error;
    };
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) abort();
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeoutMs ?? 15_000);
    let rejectAbort: () => void = () => {};
    const cancellation = new Promise<never>((_, reject) => {
      rejectAbort = () => reject(aborted());
      controller.signal.addEventListener('abort', rejectAbort, { once: true });
    });
    try {
      if (controller.signal.aborted) throw aborted();
      const run = async () => {
        const response = await (transport.fetch ?? globalThis.fetch)(
          `${transport.baseUrl.replace(/\/$/, '')}${path}`,
          {
            ...init,
            headers: {
              ...(init.body ? { 'Content-Type': 'application/json' } : {}),
              ...transport.headers?.(),
              ...init.headers,
            },
            signal: controller.signal,
          },
        );
        if (controller.signal.aborted) throw aborted();
        if (!response.ok) {
          const body: unknown = await response.json().catch(() => null);
          throw new ApiError(
            apiErrorBodySchema.parse(body).message ||
              response.statusText ||
              `HTTP ${response.status}`,
            response.status,
            body,
          );
        }
        return consume(response, controller.signal);
      };
      return await Promise.race([run(), cancellation]);
    } catch (error) {
      if (controller.signal.aborted) throw aborted();
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        error instanceof Error ? error.message : 'Request failed.',
      );
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
      controller.signal.removeEventListener('abort', rejectAbort);
    }
  };
}
