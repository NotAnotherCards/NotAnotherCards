import { aiPlaygroundEventSchema, type AiPlaygroundEvent } from '@repo/schemas';
import { readEventStream } from './read-event-stream.js';

/** Only a validated result makes the run successful. */
export function readPlaygroundStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: AiPlaygroundEvent) => void,
  signal?: AbortSignal,
) {
  return readEventStream(body, {
    signal,
    limitBytes: 2_000_000,
    earlyCloseMessage: 'Creation connection closed before the result arrived.',
    sizeMessage: 'Creation response is too large.',
    onEvent(raw) {
      const parsed = aiPlaygroundEventSchema.safeParse(raw);
      if (!parsed.success) throw new Error('Invalid creation response.');
      const event = parsed.data;
      onEvent(event);
      if (event.type === 'error') throw new Error(event.message);
      if (event.type === 'result') return event.cards;
    },
  });
}
