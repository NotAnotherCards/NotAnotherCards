import { useEffect, useState } from 'react';
import { CreateAiJobInput, AiCardOutput } from '@repo/schemas';
import { AiPlaygroundForm } from './AiPlaygroundForm';
import { AiJobStatusTracker, JobStatus } from './AiJobStatusTracker';
import { AiResultPreview } from './AiResultPreview';
import { Calendar, Zap, AlertCircle } from 'lucide-react';
import { useStore } from '@/hooks/useStore';

export interface Quota {
  used?: number;
  limit?: number;
  requestsUsed?: number;
  maxRequests?: number;
  usedTokens?: number;
  maxTokens?: number;
  activePendingJobs?: number;
  maxPendingJobs?: number;
}

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
  const [quota, setQuota] = useState<Quota | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Retrieve local store to get actual decks for dropdown list
  const { decks, createDeck, createCard } = useStore();

  const fetchQuota = async () => {
    try {
      const res = await fetch('/api/ai/quota');
      if (res.ok) {
        const data = await res.json();
        setQuota(data.quota);
      }
    } catch (err) {
      console.error('Failed to fetch quota:', err);
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/ai/jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
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
        const errData = await res.json();
        throw new Error((errData.message as string) || 'Failed to submit job');
      }

      const data = await res.json();
      setCurrentJob(data.job);
      void fetchQuota();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error occurred starting job';
      setErrorMessage(msg);
      setLoading(false);
    }
  };

  const handlePollJob = async () => {
    if (!currentJob) return;
    try {
      const res = await fetch(`/api/ai/jobs/${currentJob.id}`);
      if (res.ok) {
        const data = await res.json();
        const updatedJob = data.job;
        setCurrentJob(updatedJob);

        if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
          setLoading(false);
          void fetchJobs();
        }
      }
    } catch (err) {
      console.error('Error polling job:', err);
    }
  };

  const handleSaveDeck = async (deckIdOrTitle: string, isNew: boolean) => {
    if (!currentJob || !currentJob.result) return;
    setSaving(true);
    try {
      let targetDeckId = deckIdOrTitle;
      if (isNew) {
        const newDeck = await createDeck(deckIdOrTitle, 'AI Generated Cards');
        targetDeckId = newDeck.id;
      }

      // Simulate writing user_notes, user_note_decks, and user_cards:
      // Since local schema changes are deferred, we create standard card rows in user_cards.
      for (const card of currentJob.result) {
        await createCard(targetDeckId, card.front, card.back);
      }
    } catch (err) {
      console.error('Error saving cards to deck:', err);
    } finally {
      setSaving(false);
    }
  };

  const selectPastJob = (job: Job) => {
    setCurrentJob(job);
    setErrorMessage(null);
    setLoading(false);
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left side: Config Form & Job Status Tracker */}
      <div className="lg:col-span-5 space-y-6">
        {errorMessage && (
          <div className="flex gap-2.5 items-start bg-destructive/10 border border-destructive/20 rounded-2xl p-4 text-sm text-destructive">
            <AlertCircle className="size-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold">Generation Failed</h4>
              <p className="text-xs text-destructive/80 mt-1">{errorMessage}</p>
            </div>
          </div>
        )}

        {loading && currentJob ? (
          <AiJobStatusTracker
            jobId={currentJob.id}
            status={currentJob.status}
            error={currentJob.error}
            onPoll={handlePollJob}
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
      </div>

      {/* Right side: Results Preview & Past Jobs Log */}
      <div className="lg:col-span-7 space-y-8">
        {currentJob && currentJob.status === 'completed' && currentJob.result ? (
          <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-md">
            <AiResultPreview
              cards={currentJob.result}
              decks={decks.map(d => ({ id: d.id, title: d.title }))}
              onSave={handleSaveDeck}
              isSaving={saving}
            />
          </div>
        ) : (
          <div className="bg-card/40 border border-dashed border-border/80 rounded-3xl p-12 text-center text-muted-foreground flex flex-col items-center justify-center space-y-4">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <Zap className="size-6" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">No Results Preview</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Trigger a generation task or select a completed past job from the log below to view results.
              </p>
            </div>
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
              <p className="text-xs text-muted-foreground text-center py-6">No previous jobs found.</p>
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
                        {job.type === 'topic_deck' ? 'Topic' : 'Source Paragraph'}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">•</span>
                      <span className="text-[10px] font-mono text-muted-foreground/80">{job.id.slice(0, 8)}</span>
                    </div>
                    <p className="text-sm font-semibold truncate text-foreground/90">
                      {job.payload.topic || job.payload.sourceText || 'Untitled job'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      job.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : job.status === 'failed'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-amber-500/10 text-amber-500'
                    }`}>
                      {job.status}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}