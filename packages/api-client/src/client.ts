import {
  sharedDeckListSchema,
  sharedDeckPreviewSchema,
  sharedDeckImportSchema,
  deckReportResponseSchema,
  publishResponseSchema,
  moderationRefusalSchema,
  ownerModerationStatusSchema,
  moderationExplanationEventSchema,
  type ModerationExplanationRequest,
  type ModerationRefusal,
  type ModerationWarning,
} from '@repo/schemas';
import {
  ApiError,
  createRequest,
  type ApiTransport,
  type RequestOptions,
} from './transport.js';
import { readEventStream } from './read-event-stream.js';

export type PublishOutcome =
  | { published: true; warnings: ModerationWarning[] }
  | { published: false; refusal: ModerationRefusal };

export function createApiClient(transport: ApiTransport) {
  const request = createRequest(transport);
  const json = <T>(
    path: string,
    schema: { parse: (body: unknown) => T },
    init: RequestInit = {},
    options?: RequestOptions,
  ) =>
    request(
      path,
      init,
      async (response) => {
        const body: unknown = await response.json();
        return schema.parse(body);
      },
      options,
    );
  const deckPath = (id: string) => `/api/decks/${encodeURIComponent(id)}`;
  const sharedPath = (id: string) =>
    `/api/shared/decks/${encodeURIComponent(id)}`;

  return {
    sharedDecks: {
      list(
        page: { limit?: number; offset?: number } = {},
        options?: RequestOptions,
      ) {
        const query = new URLSearchParams();
        if (page.limit !== undefined) query.set('limit', String(page.limit));
        if (page.offset !== undefined) query.set('offset', String(page.offset));
        return json(
          `/api/shared/decks${query.size ? `?${query}` : ''}`,
          sharedDeckListSchema,
          {},
          options,
        );
      },
      preview(id: string, options?: RequestOptions) {
        return json(sharedPath(id), sharedDeckPreviewSchema, {}, options);
      },
      import(id: string, options?: RequestOptions) {
        return json(
          `${sharedPath(id)}/import`,
          sharedDeckImportSchema,
          { method: 'POST' },
          options,
        );
      },
      report(id: string, reason: string, options?: RequestOptions) {
        return json(
          `${sharedPath(id)}/report`,
          deckReportResponseSchema,
          { method: 'POST', body: JSON.stringify({ reason }) },
          options,
        );
      },
    },
    publishing: {
      async publish(
        id: string,
        options?: RequestOptions,
      ): Promise<PublishOutcome> {
        try {
          const result = await json(
            `${deckPath(id)}/publish`,
            publishResponseSchema,
            { method: 'POST' },
            options,
          );
          return { published: true, warnings: result.warnings };
        } catch (error) {
          if (error instanceof ApiError && error.status === 422) {
            const refusal = moderationRefusalSchema.safeParse(error.body);
            if (refusal.success)
              return { published: false, refusal: refusal.data };
          }
          throw error;
        }
      },
      async unpublish(id: string, options?: RequestOptions): Promise<void> {
        await request(
          `${deckPath(id)}/unpublish`,
          { method: 'POST' },
          async (response) => {
            // No result is exposed; still consume the body within the deadline.
            await response.text();
          },
          options,
        );
      },
      moderationStatus(id: string, options?: RequestOptions) {
        return json(
          `${deckPath(id)}/moderation`,
          ownerModerationStatusSchema,
          {},
          options,
        );
      },
      explain(
        id: string,
        input: ModerationExplanationRequest,
        onDelta: (delta: string) => void,
        options?: RequestOptions,
      ) {
        return request(
          `${deckPath(id)}/moderation/explain`,
          { method: 'POST', body: JSON.stringify(input) },
          async (response, signal) => {
            if (!response.body)
              throw new Error('The explanation has no response stream.');
            return readEventStream(response.body, {
              signal,
              limitBytes: 100_000,
              earlyCloseMessage: 'The explanation connection closed early.',
              sizeMessage: 'The explanation is too large.',
              onEvent(raw) {
                const parsed = moderationExplanationEventSchema.safeParse(raw);
                if (!parsed.success)
                  throw new Error('Invalid explanation response.');
                const event = parsed.data;
                if (event.type === 'error') throw new Error(event.message);
                if (event.type === 'result') return event.explanation;
                onDelta(event.delta);
              },
            });
          },
          { ...options, timeoutMs: options?.timeoutMs ?? 60_000 },
        );
      },
    },
  };
}
