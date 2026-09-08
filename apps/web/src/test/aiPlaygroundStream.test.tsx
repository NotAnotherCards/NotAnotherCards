import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiGenerationPlaygroundComponent } from '@/components/ai/AiGenerationPlaygroundComponent';
import { readPlaygroundStream } from '@/components/ai/readPlaygroundStream';

const save = vi.fn().mockResolvedValue('deck-1');
vi.mock('@/hooks/useStore', () => ({
  useStore: () => ({
    decks: [{ id: 'deck-1', title: 'Spanish' }],
    createCardsBatch: save,
  }),
}));
const cards = [{ front: 'café', back: 'coffee' }];
const event = (value: unknown) =>
  new TextEncoder().encode('data: ' + JSON.stringify(value) + '\n\n');
let controller: ReadableStreamDefaultController<Uint8Array>;
let signal: AbortSignal;
let status: number;
const pastJob = {
  id: 'past-1',
  type: 'topic_deck',
  status: 'completed',
  payload: { topic: 'Old topic', count: 1 },
  result: [{ front: 'Past question', back: 'Past answer' }],
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  save.mockClear();
  status = 200;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (String(url).endsWith('/playground/stream')) {
      if (status === 429)
        return new Response(
          JSON.stringify({ message: 'Daily quota reached' }),
          { status },
        );
      signal = init!.signal as AbortSignal;
      return new Response(
        new ReadableStream<Uint8Array>({
          start(stream) {
            controller = stream;
            signal.addEventListener(
              'abort',
              () => stream.error(signal.reason),
              { once: true },
            );
          },
        }),
      );
    }
    if (String(url).endsWith('/jobs'))
      return new Response(JSON.stringify({ jobs: [pastJob] }));
    return new Response(
      JSON.stringify({
        quota: {
          requestsUsed: 0,
          maxRequests: 25,
          usedTokens: 0,
          maxTokens: 50000,
          activePendingJobs: 0,
          maxPendingJobs: 2,
        },
      }),
    );
  });
});
afterEach(() => vi.restoreAllMocks());
async function start() {
  fireEvent.change(screen.getByLabelText(/Subject \/ Topic/i), {
    target: { value: 'Coffee' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: /Start Card Generation/i }),
  );
  await waitFor(() =>
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/ai/playground/stream',
      expect.anything(),
    ),
  );
}

describe('streaming in the existing playground', () => {
  it('shows fragmented UTF-8 deltas before reusing the preview and save flow', async () => {
    render(<AiGenerationPlaygroundComponent />);
    await start();
    const encoded = event({ type: 'delta', delta: 'café' });
    const cut = encoded.indexOf(0xc3) + 1;
    await act(async () => {
      controller.enqueue(encoded.slice(0, cut));
    });
    expect(
      screen.getByLabelText('Live generation output'),
    ).not.toHaveTextContent('café');
    await act(async () => {
      controller.enqueue(encoded.slice(cut));
    });
    expect(screen.getByLabelText('Live generation output')).toHaveTextContent(
      'café',
    );
    expect(screen.queryByText('Generation Results')).not.toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      controller.enqueue(event({ type: 'result', cards }));
      controller.close();
    });
    expect(await screen.findByText('Generation Results')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /Save Cards to Deck/i }),
    );
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ cards, deckIdOrTitle: 'deck-1' }),
      ),
    );
  });
  it('rejects premature EOF even when the partial text looks like valid cards', async () => {
    render(<AiGenerationPlaygroundComponent />);
    await start();
    await act(async () => {
      controller.enqueue(
        event({ type: 'delta', delta: JSON.stringify(cards) }),
      );
      controller.close();
    });
    expect(
      await screen.findByText(
        'Generation connection closed before the result arrived.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Generation Results')).not.toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });
  it('shows a streamed timeout in the existing error panel', async () => {
    render(<AiGenerationPlaygroundComponent />);
    await start();
    await act(async () => {
      controller.enqueue(
        event({ type: 'error', message: 'Card generation timed out.' }),
      );
      controller.close();
    });
    expect(
      await screen.findByText('Card generation timed out.'),
    ).toBeInTheDocument();
  });
  it('aborts when selecting history and keeps the historical result', async () => {
    render(<AiGenerationPlaygroundComponent />);
    await screen.findByText('Old topic');
    await start();
    fireEvent.click(screen.getByText('Old topic'));
    expect(signal.aborted).toBe(true);
    expect(await screen.findByText('Past question')).toBeInTheDocument();
    expect(screen.queryByText('Generation Failed')).not.toBeInTheDocument();
  });
  it('aborts on unmount', async () => {
    const view = render(<AiGenerationPlaygroundComponent />);
    await start();
    view.unmount();
    expect(signal.aborted).toBe(true);
  });
  it('shows a quota refusal', async () => {
    status = 429;
    render(<AiGenerationPlaygroundComponent />);
    await start();
    expect(await screen.findByText('Daily quota reached')).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });
  it.each([
    'data: not-json\n\n',
    'data: {"type":"result","cards":[{"front":42,"back":"invalid"}]}\n\n',
  ])('rejects malformed events or card data', async (wire) => {
    await expect(
      readPlaygroundStream(new Response(wire).body!, () => {}),
    ).rejects.toThrow();
  });
});
