import { useEffect, useRef, useState } from 'react';
import {
  aiJobResponseSchema,
  aiJobsResponseSchema,
  aiQuotaResponseSchema,
  apiErrorBodySchema,
  CreateAiJobInput,
  QuotaStatus,
  type AiJob,
  type AiCardOutput,
  type AiWordNoteCandidate,
} from '@repo/schemas';
import { AiPlaygroundForm } from './AiPlaygroundForm';
import { AiJobStatusTracker } from './AiJobStatusTracker';
import { readPlaygroundStream } from './readPlaygroundStream';
import { AiResultPreview } from './AiResultPreview';
import { AiWordNotePreview } from './AiWordNotePreview';
import { Calendar, Zap, AlertCircle } from 'lucide-react';
import { useStore } from '@/hooks/useStore';

type Job = AiJob;

export function AiGenerationPlaygroundComponent() {
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [streamText, setStreamText] = useState('');
  const [streamResult, setStreamResult] = useState<AiCardOutput[] | null>(null);
  const streamRequest = useRef<AbortController | null>(null);
  const liveOutput = useRef<HTMLPreElement>(null);

  const cards =
    streamResult ??
    (currentJob?.status === 'completed' && Array.isArray(currentJob.result)
      ? currentJob.result
      : null);

  const wordNoteCandidate =
    currentJob?.status === 'completed' &&
    currentJob.result &&
    !Array.isArray(currentJob.result)
      ? (currentJob.result as AiWordNoteCandidate)
      : null;

  useEffect(() => () => streamRequest.current?.abort(), []);

  useEffect(() => {
    if (liveOutput.current)
      liveOutput.current.scrollTop = liveOutput.current.scrollHeight;
  }, [streamText]);

  const { decks, createCardsBatch, createDeck, createNote } = useStore();

  useEffect(() => {
    if (
      !currentJob ||
      (currentJob.status !== 'pending' && currentJob.status !== 'processing')
    ) {
      return;
    }

    let disposed = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (disposed) return;

      let terminalStateReached = false;

      try {
        const res = await fetch(`/api/ai/jobs/${currentJob.id}`);
        if (disposed) return;
        if (!res.ok) {
          const { message } = apiErrorBodySchema.parse(
            await res.json().catch(() => null),
          );
          if (disposed) return;
          setErrorMessage(message || 'Failed to poll job status');
          setCurrentJob((prev) =>
            prev ? { ...prev, status: 'failed' } : null,
          );
          setLoading(false);
          terminalStateReached = true;
          return;
        }

        const { job: updatedJob } = aiJobResponseSchema.parse(await res.json());
        if (disposed) return;
        setCurrentJob(updatedJob);

        if (
          updatedJob.status === 'completed' ||
          updatedJob.status === 'failed'
        ) {
          if (updatedJob.status === 'failed') {
            setErrorMessage(
              'Creation could not be completed. Please try again with a different input.',
            );
          }
          setLoading(false);
          terminalStateReached = true;
          void fetchJobs();
          void fetchQuota();
        }
      } catch {
        if (disposed) return;
        setErrorMessage(
          'Unable to update job status. Please check your connection.',
        );
        setCurrentJob((prev) => (prev ? { ...prev, status: 'failed' } : null));
        setLoading(false);
        terminalStateReached = true;
      } finally {
        if (!disposed && !terminalStateReached) {
          timeoutId = setTimeout(() => void poll(), 1000);
        }
      }
    };

    void poll();

    return () => {
      disposed = true;
      clearTimeout(timeoutId);
    };
  }, [currentJob?.id, currentJob?.status]);

  const fetchQuota = async () => {
    try {
      const res = await fetch('/api/ai/quota');
      if (res.ok) {
        const { quota } = aiQuotaResponseSchema.parse(await res.json());
        setQuota(quota);
      }
    } catch {
      // Background quota fetch failure handled gracefully
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/ai/jobs');
      if (res.ok) {
        const { jobs } = aiJobsResponseSchema.parse(await res.json());
        setJobs(jobs);
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
    streamRequest.current?.abort();
    const request = new AbortController();
    streamRequest.current = request;
    setCurrentJob(null);
    setStreamResult(null);
    setStreamText('');
    setLoading(true);
    setErrorMessage(null);
    try {
      if (input.type === 'topic_deck') {
        const res = await fetch('/api/ai/playground/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
          signal: request.signal,
        });
        if (!res.ok) {
          const { message } = apiErrorBodySchema.parse(
            await res.json().catch(() => null),
          );
          throw new Error(
            message || 'Unable to start card creation. Please try again.',
          );
        }
        if (!res.body) throw new Error('Creation response has no stream.');
        const result = await readPlaygroundStream(res.body, (delta) => {
          if (!request.signal.aborted) setStreamText((text) => text + delta);
        });
        if (!request.signal.aborted) setStreamResult(result);
      } else {
        const res = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
          signal: request.signal,
        });
        if (!res.ok) {
          const { message } = apiErrorBodySchema.parse(
            await res.json().catch(() => null),
          );
          throw new Error(
            message || 'Unable to start creation. Please try again.',
          );
        }
        const data = aiJobResponseSchema.parse(await res.json());
        if (!request.signal.aborted) setCurrentJob(data.job);
        // Polling will take over from here
        return;
      }
    } catch (error) {
      if (!request.signal.aborted) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to create.',
        );
      }
    } finally {
      if (input.type === 'topic_deck') {
        if (!request.signal.aborted) {
          setLoading(false);
          void fetchQuota();
          void fetchJobs();
        }
      }
      if (streamRequest.current === request) streamRequest.current = null;
    }
  };

  const handleSaveDeck = async (deckIdOrTitle: string, isNew: boolean) => {
    if (!cards) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      await createCardsBatch({
        deckIdOrTitle,
        isNew,
        description: 'Created Cards',
        cards: cards.map((card) => ({
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

  const handleSaveWordNote = async () => {
    if (!wordNoteCandidate || !currentJob || currentJob.type !== 'word_note')
      return;
    setSaving(true);
    setErrorMessage(null);
    try {
      await createNote(
        currentJob.payload.deckId,
        wordNoteCandidate.noteType,
        wordNoteCandidate.fieldsVersion,
        wordNoteCandidate.fields,
      );
    } catch {
      const msg = 'Unable to save word note to deck. Please try again.';
      setErrorMessage(msg);
      throw new Error(msg);
    } finally {
      setSaving(false);
    }
  };

  const selectPastJob = (job: Job) => {
    streamRequest.current?.abort();
    streamRequest.current = null;
    setStreamResult(null);
    setStreamText('');
    setCurrentJob(job);
    if (job.status === 'failed') {
      setErrorMessage(
        'Creation could not be completed. Please try again with a different input.',
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

  const getTargetDeckName = (deckId: string) => {
    return decks.find((d) => d.id === deckId)?.title || 'Selected Deck';
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div className="lg:col-span-5 space-y-6">
        {loading &&
        (currentJob?.status === 'pending' ||
          currentJob?.status === 'processing' ||
          !currentJob) ? (
          <AiJobStatusTracker
            jobId={currentJob?.id}
            status={currentJob?.status ?? 'processing'}
            error={currentJob?.error}
          />
        ) : (
          <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-md">
            <AiPlaygroundForm
              quota={quota}
              onSubmit={handleStartGeneration}
              isSubmitting={loading}
              decks={decks.map((d) => ({
                id: d.id,
                title: d.title,
                note_type: d.note_type,
              }))}
              createDeck={createDeck}
            />
          </div>
        )}

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
                          : job.type === 'text_cards'
                            ? 'Source Paragraph'
                            : 'Word'}
                      </span>
                    </div>
                    <p className="text-sm font-semibold truncate text-foreground/90">
                      {job.type === 'topic_deck'
                        ? job.payload.topic
                        : job.type === 'text_cards'
                          ? job.payload.sourceText
                          : job.payload.word}
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

      <div className="lg:col-span-7 space-y-8">
        {loading &&
        (!currentJob ||
          currentJob?.status === 'processing' ||
          currentJob?.status === 'pending') &&
        !cards &&
        !wordNoteCandidate ? (
          <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-md space-y-3">
            <h3 className="text-base font-bold tracking-tight">Live Output</h3>
            <pre
              ref={liveOutput}
              aria-label="Live creation output"
              className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-muted p-3 text-xs text-muted-foreground"
            >
              {streamText || 'Waiting for the first text…'}
            </pre>
          </div>
        ) : cards ? (
          <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-md">
            <AiResultPreview
              cards={cards}
              decks={decks.map((d) => ({ id: d.id, title: d.title }))}
              onSave={handleSaveDeck}
              isSaving={saving}
            />
          </div>
        ) : wordNoteCandidate && currentJob?.type === 'word_note' ? (
          <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-md">
            <AiWordNotePreview
              note={wordNoteCandidate}
              deckName={getTargetDeckName(currentJob.payload.deckId)}
              onSave={handleSaveWordNote}
              isSaving={saving}
            />
          </div>
        ) : errorMessage || (currentJob && currentJob.status === 'failed') ? (
          <div className="bg-card border border-destructive/30 bg-destructive/5 rounded-3xl p-8 shadow-md flex flex-col items-center justify-center text-center space-y-4">
            <div className="size-12 rounded-2xl bg-destructive/15 text-destructive flex items-center justify-center">
              <AlertCircle className="size-6" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <h3 className="text-xl font-bold mb-2">
                {currentJob ? 'Creation Job Failed' : 'Creation Failed'}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {errorMessage ||
                  currentJob?.error ||
                  'Creation could not be completed. Please try again with a different input.'}
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
              <p className="text-sm text-muted-foreground/80 max-w-sm mx-auto leading-relaxed">
                Trigger a creation task or select a completed past job from the
                history panel to view results.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
