import { useEffect, useState } from 'react';
import {
  apiErrorBodySchema,
  CreateAiJobInput,
  AiCardOutput,
  QuotaStatus,
} from '@repo/schemas';
import { AiPlaygroundForm } from './AiPlaygroundForm';
import { AiJobStatusTracker, JobStatus } from './AiJobStatusTracker';
import { AiResultPreview } from './AiResultPreview';
import { Calendar, Zap, AlertCircle } from 'lucide-react';
import { useStore } from '@/hooks/useStore';

interface Job {
  id: string;
  type: 'topic_deck' | 'text_cards';
  status: JobStatus;
  payload: {
    topic?: string;
    sourceText?: string;
    count: number;
    model?: string;
  };
  result?: AiCardOutput[] | null;
  error?: string | null;
  createdAt: string;
}

export function AiGenerationPlaygroundComponent() {
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Retrieve local store to get actual decks for dropdown list
  const { decks, createCardsBatch } = useStore();

  // Parent polling effect watching currentJob id and status
  useEffect(() => {
    if (
      !currentJob ||
      (currentJob.status !== 'pending' && currentJob.status !== 'processing')
    ) {
      return;
    }

    const poll = async () => {
      try {
        const res = await fetch(`/api/ai/jobs/${currentJob.id}`);
        if (!res.ok) {
          const { message } = apiErrorBodySchema.parse(
            await res.json().catch(() => null),
          );
          setErrorMessage(message || 'Failed to poll job status');
          setCurrentJob((prev) =>
            prev ? { ...prev, status: 'failed' } : null,
          );
          setLoading(false);
          return;
        }

        const data = await res.json();
        const updatedJob = data.job;
        setCurrentJob(updatedJob);

        if (
          updatedJob.status === 'completed' ||
          updatedJob.status === 'failed'
        ) {
          if (updatedJob.status === 'failed') {
            setErrorMessage(
              'Card generation could not be completed. Please try again with a different topic.',
            );
          }
          setLoading(false);
          void fetchJobs();
          void fetchQuota();
        }
      } catch {
        setErrorMessage(
          'Unable to update job status. Please check your connection.',
        );
        setCurrentJob((prev) => (prev ? { ...prev, status: 'failed' } : null));
        setLoading(false);
      }
    };

    void poll();

    const intervalId = setInterval(() => {
      void poll();
    }, 1000);

    return () => clearInterval(intervalId);
  }, [currentJob?.id, currentJob?.status]);

  const fetchQuota = async () => {
    try {
      const res = await fetch('/api/ai/quota');
      if (res.ok) {
        const data = await res.json();
        setQuota(data.quota);
      }
    } catch {
      // Background quota fetch failure handled gracefully
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/ai/jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch {
      // Background jobs list fetch failure handled gracefully
    }
  };

  useEffect(() => {
    void fetchQuota();
    void fetchJobs();
  }, []);

  const handleStartGeneration = async (input: CreateAiJobInput) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const { message } = apiErrorBodySchema.parse(
          await res.json().catch(() => null),
        );
        throw new Error(
          message || 'Unable to start card generation. Please try again.',
        );
      }

      const data = await res.json();
      setCurrentJob(data.job);
      void fetchQuota();
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Unable to start generation job. Please try again.';
      setErrorMessage(msg);
      setLoading(false);
    }
  };

  const handleSaveDeck = async (deckIdOrTitle: string, isNew: boolean) => {
    if (!currentJob || !currentJob.result) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      await createCardsBatch({
        deckIdOrTitle,
        isNew,
        description: 'AI Generated Cards',
        cards: currentJob.result.map((card) => ({
          front: card.front,
          back: card.back,
        })),
      });
    } catch {
      const msg = 'Unable to save cards to deck. Please try again.';
      setErrorMessage(msg);
      throw new Error(msg);
    } finally {
      setSaving(false);
    }
  };

  const selectPastJob = (job: Job) => {
    setCurrentJob(job);
    if (job.status === 'failed') {
      setErrorMessage(
        'Card generation could not be completed. Please try again with a different topic.',
      );
    } else {
      setErrorMessage(null);
    }
    if (job.status === 'pending' || job.status === 'processing') {
      setLoading(true);
    } else {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left side: Config Form & Job Status Tracker */}
      <div className="lg:col-span-5 space-y-6">
        {loading && currentJob ? (
          <AiJobStatusTracker
            jobId={currentJob.id}
            status={currentJob.status}
            error={currentJob.error}
          />
        ) : (
          <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-md">
            <AiPlaygroundForm
              quota={quota}
              onSubmit={handleStartGeneration}
              isSubmitting={loading}
            />
          </div>
        )}

        {/* Previous Jobs Log */}
        <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-md space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold tracking-tight flex items-center gap-1.5">
              <Calendar className="size-4.5 text-muted-foreground" />
              Previous Jobs History
            </h3>
            <span className="text-xs font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
              {jobs.length} total
            </span>
          </div>

          <div className="space-y-2.5 max-h-62.5 overflow-y-auto pr-1">
            {jobs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                No previous jobs found.
              </p>
            ) : (
              jobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => selectPastJob(job)}
                  className={`w-full text-left p-3 rounded-2xl border transition-all duration-200 flex items-center justify-between group ${
                    currentJob?.id === job.id
                      ? 'bg-violet-500/5 border-violet-500/30'
                      : 'bg-muted/30 border-border/40 hover:bg-muted/60 hover:border-border/60'
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {job.type === 'topic_deck'
                          ? 'Topic'
                          : 'Source Paragraph'}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">
                        •
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground/80">
                        {job.id.slice(0, 8)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold truncate text-foreground/90">
                      {job.payload.topic ||
                        job.payload.sourceText ||
                        'Untitled job'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        job.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : job.status === 'failed'
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-amber-500/10 text-amber-500'
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right side: Results Preview or Error Message */}
      <div className="lg:col-span-7 space-y-8">
        {currentJob &&
        currentJob.status === 'completed' &&
        currentJob.result ? (
          <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-md">
            <AiResultPreview
              cards={currentJob.result}
              decks={decks.map((d) => ({ id: d.id, title: d.title }))}
              onSave={handleSaveDeck}
              isSaving={saving}
            />
          </div>
        ) : errorMessage || (currentJob && currentJob.status === 'failed') ? (
          <div className="bg-card border border-destructive/30 bg-destructive/5 rounded-3xl p-8 shadow-md flex flex-col items-center justify-center text-center space-y-4">
            <div className="size-12 rounded-2xl bg-destructive/15 text-destructive flex items-center justify-center">
              <AlertCircle className="size-6" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <h3 className="font-bold text-foreground text-base">
                Generation Job Failed
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {errorMessage ||
                  currentJob?.error ||
                  'Card generation could not be completed. Please try again with a different topic.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-card/40 border border-dashed border-border/80 rounded-3xl p-12 text-center text-muted-foreground flex flex-col items-center justify-center space-y-4">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <Zap className="size-6" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">
                No Results Preview
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Trigger a generation task or select a completed past job from
                the log on the left to view results.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
