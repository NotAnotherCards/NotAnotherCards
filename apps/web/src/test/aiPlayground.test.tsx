import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { AiPlaygroundForm } from '@/components/ai/AiPlaygroundForm';
import { AiJobStatusTracker } from '@/components/ai/AiJobStatusTracker';
import { AiResultPreview } from '@/components/ai/AiResultPreview';
import { AiGenerationPlaygroundComponent } from '@/components/ai/AiGenerationPlaygroundComponent';

// Mock useStore hook for deck operations
const mockCreateDeck = vi
  .fn()
  .mockResolvedValue({ id: 'deck-new-1', title: 'New Test Deck' });
const mockCreateCard = vi.fn().mockResolvedValue({ id: 'card-1' });
const mockCreateCardsBatch = vi.fn().mockResolvedValue('deck-1');

vi.mock('@/hooks/useStore', () => ({
  useStore: () => ({
    decks: [{ id: 'deck-1', title: 'Spanish Vocab' }],
    createDeck: mockCreateDeck,
    createCard: mockCreateCard,
    createCardsBatch: mockCreateCardsBatch,
  }),
}));

describe('AI Generation Playground Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('AiPlaygroundForm Component', () => {
    it('renders quota status indicator and topic field correctly', () => {
      const quota = {
        requestsUsed: 5,
        maxRequests: 25,
        usedTokens: 500,
        maxTokens: 50000,
        activePendingJobs: 0,
        maxPendingJobs: 2,
      };
      render(
        <AiPlaygroundForm
          quota={quota}
          onSubmit={vi.fn()}
          isSubmitting={false}
        />,
      );

      expect(screen.getByText('AI Quota Status')).toBeInTheDocument();
      expect(screen.getByText('5/25 requests used')).toBeInTheDocument();
      expect(screen.getByLabelText(/Subject \/ Topic/i)).toBeInTheDocument();
    });

    it('shows validation error when submitting an empty topic', async () => {
      const handleSubmit = vi.fn();
      render(
        <AiPlaygroundForm
          quota={null}
          onSubmit={handleSubmit}
          isSubmitting={false}
        />,
      );

      const submitBtn = screen.getByRole('button', {
        name: /Start Card Generation/i,
      });
      fireEvent.click(submitBtn);

      expect(
        await screen.findByText('Subject/Topic cannot be empty'),
      ).toBeInTheDocument();
      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('submits valid form inputs with model selection and card count', async () => {
      const handleSubmit = vi.fn();
      const user = userEvent.setup();

      render(
        <AiPlaygroundForm
          quota={{
            requestsUsed: 0,
            maxRequests: 25,
            usedTokens: 0,
            maxTokens: 50000,
            activePendingJobs: 0,
            maxPendingJobs: 2,
          }}
          onSubmit={handleSubmit}
          isSubmitting={false}
        />,
      );

      const topicInput = screen.getByLabelText(/Subject \/ Topic/i);
      await user.type(topicInput, 'German Modal Verbs');

      const modelSelect = screen.getByLabelText(/Model Selection/i);
      await user.selectOptions(modelSelect, 'qwen-next-80b');

      const submitBtn = screen.getByRole('button', {
        name: /Start Card Generation/i,
      });
      await user.click(submitBtn);

      expect(handleSubmit).toHaveBeenCalledWith({
        type: 'topic_deck',
        topic: 'German Modal Verbs',
        count: 5,
        model: 'qwen-next-80b',
      });
    });
  });

  describe('AiJobStatusTracker Component', () => {
    it('renders active pending/processing steps for presentational tracking', () => {
      render(<AiJobStatusTracker jobId="job-123" status="processing" />);

      expect(screen.getByText('Generating Your Deck')).toBeInTheDocument();
      expect(screen.getByText('Job ID: job-123')).toBeInTheDocument();
      expect(screen.getByText('Processing LLM')).toBeInTheDocument();
    });

    it('renders error message when job status is failed', () => {
      render(
        <AiJobStatusTracker
          jobId="job-456"
          status="failed"
          error="Model execution timed out"
        />,
      );

      expect(
        screen.getByText('Error: Model execution timed out'),
      ).toBeInTheDocument();
    });
  });

  describe('AiResultPreview Component', () => {
    const mockCards = [
      { front: 'What is "Hund" in English?', back: 'Dog' },
      { front: 'What is "Katze" in English?', back: 'Cat' },
    ];

    it('previews cards and allows switching to JSON Note Schema tab', async () => {
      const user = userEvent.setup();
      render(
        <AiResultPreview
          cards={mockCards}
          decks={[{ id: 'deck-1', title: 'Spanish' }]}
          onSave={vi.fn()}
          isSaving={false}
        />,
      );

      expect(
        screen.getByText('What is "Hund" in English?'),
      ).toBeInTheDocument();
      expect(screen.getByText('Dog')).toBeInTheDocument();

      const schemaTab = screen.getByRole('button', { name: /Note Schema/i });
      await user.click(schemaTab);

      expect(screen.getByText(/"note_type": "basic"/)).toBeInTheDocument();
    });

    it('triggers onSave and displays toast notification when saved successfully', async () => {
      const handleSave = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();

      render(
        <AiResultPreview
          cards={mockCards}
          decks={[{ id: 'deck-1', title: 'Spanish Vocab' }]}
          onSave={handleSave}
          isSaving={false}
        />,
      );

      const saveBtn = screen.getByRole('button', {
        name: /Save Cards to Deck/i,
      });
      await user.click(saveBtn);

      expect(handleSave).toHaveBeenCalledWith('deck-1', false);

      await waitFor(() => {
        expect(screen.getByText('Deck Saved!')).toBeInTheDocument();
        expect(
          screen.getByText('Cards have been added to your local library.'),
        ).toBeInTheDocument();
      });
    });

    it('does not show success toast and displays error message when onSave rejects', async () => {
      const handleSave = vi
        .fn()
        .mockRejectedValue(new Error('Database write rejected'));
      const user = userEvent.setup();

      render(
        <AiResultPreview
          cards={mockCards}
          decks={[{ id: 'deck-1', title: 'Spanish Vocab' }]}
          onSave={handleSave}
          isSaving={false}
        />,
      );

      const saveBtn = screen.getByRole('button', {
        name: /Save Cards to Deck/i,
      });
      await user.click(saveBtn);

      expect(handleSave).toHaveBeenCalledWith('deck-1', false);

      await waitFor(() => {
        expect(
          screen.getByText('Database write rejected'),
        ).toBeInTheDocument();
      });

      expect(screen.queryByText('Deck Saved!')).not.toBeInTheDocument();
    });
  });

  describe('AiGenerationPlaygroundComponent', () => {
    it('fetches quota and previous jobs history on mount', async () => {
      const mockQuota = { quota: { requestsUsed: 2, maxRequests: 25 } };
      const mockJobs = {
        jobs: [
          {
            id: 'job-1',
            type: 'topic_deck',
            status: 'completed',
            payload: { topic: 'French Verbs', count: 5 },
            result: [{ front: 'Avoir', back: 'To have' }],
            createdAt: new Date().toISOString(),
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
        if (String(url).includes('/api/ai/quota')) {
          return Promise.resolve(
            new Response(JSON.stringify(mockQuota), { status: 200 }),
          );
        }
        if (String(url).includes('/api/ai/jobs')) {
          return Promise.resolve(
            new Response(JSON.stringify(mockJobs), { status: 200 }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({}), { status: 200 }),
        );
      });

      render(<AiGenerationPlaygroundComponent />);

      await waitFor(() => {
        expect(screen.getByText('Previous Jobs History')).toBeInTheDocument();
        expect(screen.getByText('French Verbs')).toBeInTheDocument();
        expect(screen.getByText('2/25 requests used')).toBeInTheDocument();
      });
    });

    it('resumes polling when selecting a pending job from previous history', async () => {
      let polledJobId = '';
      const mockJobs = {
        jobs: [
          {
            id: 'job-pending-999',
            type: 'topic_deck',
            status: 'processing',
            payload: { topic: 'German Grammar', count: 5 },
            createdAt: new Date().toISOString(),
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
        if (String(url).includes('/api/ai/quota')) {
          return Promise.resolve(
            new Response(JSON.stringify({ quota: {} }), { status: 200 }),
          );
        }
        if (String(url).includes('/api/ai/jobs/job-pending-999')) {
          polledJobId = 'job-pending-999';
          return Promise.resolve(
            new Response(
              JSON.stringify({
                job: {
                  id: 'job-pending-999',
                  type: 'topic_deck',
                  status: 'completed',
                  payload: { topic: 'German Grammar', count: 5 },
                  result: [{ front: 'Haben', back: 'To have' }],
                  createdAt: new Date().toISOString(),
                },
              }),
              { status: 200 },
            ),
          );
        }
        if (String(url).includes('/api/ai/jobs')) {
          return Promise.resolve(
            new Response(JSON.stringify(mockJobs), { status: 200 }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({}), { status: 200 }),
        );
      });

      render(<AiGenerationPlaygroundComponent />);

      await waitFor(() => {
        expect(screen.getByText('German Grammar')).toBeInTheDocument();
      });

      // Select the pending job from history log
      fireEvent.click(screen.getByText('German Grammar'));

      // Verify polling is resumed for this pending job and updates job status to completed
      await waitFor(() => {
        expect(polledJobId).toBe('job-pending-999');
        expect(screen.getByText('Generation Results')).toBeInTheDocument();
        expect(screen.getByText('Haben')).toBeInTheDocument();
      });
    });

    it('stops polling and sets job status to failed when polling encounters an error', async () => {
      let pollCallCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
        if (String(url).includes('/api/ai/quota')) {
          return Promise.resolve(
            new Response(JSON.stringify({ quota: {} }), { status: 200 }),
          );
        }
        if (String(url).includes('/api/ai/jobs/job-err-1')) {
          pollCallCount += 1;
          return Promise.resolve(
            new Response(
              JSON.stringify({ message: 'Internal server error during poll' }),
              { status: 500 },
            ),
          );
        }
        if (String(url).includes('/api/ai/jobs')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                jobs: [
                  {
                    id: 'job-err-1',
                    type: 'topic_deck',
                    status: 'processing',
                    payload: { topic: 'Testing error path', count: 5 },
                    createdAt: new Date().toISOString(),
                  },
                ],
              }),
              { status: 200 },
            ),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({}), { status: 200 }),
        );
      });

      render(<AiGenerationPlaygroundComponent />);

      // Click on the processing job to select it and trigger polling effect
      await waitFor(() => {
        expect(screen.getByText('Testing error path')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Testing error path'));

      await waitFor(() => {
        expect(
          screen.getByText('Internal server error during poll'),
        ).toBeInTheDocument();
      });

      const initialPollCount = pollCallCount;
      // Wait 1.2s (interval is 1s)
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Verify polling stopped (pollCallCount did not increase further)
      expect(pollCallCount).toBe(initialPollCount);
    });
  });
});
