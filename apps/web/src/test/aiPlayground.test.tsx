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

vi.mock('@/hooks/useStore', () => ({
  useStore: () => ({
    decks: [{ id: 'deck-1', title: 'Spanish Vocab' }],
    createDeck: mockCreateDeck,
    createCard: mockCreateCard,
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
      const quota = { requestsUsed: 5, maxRequests: 25 };
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
          quota={{ requestsUsed: 0, maxRequests: 25 }}
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
  });
});
