import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

import type { AiJobStatus } from '@repo/schemas';

export type JobStatus = AiJobStatus;

interface AiJobStatusTrackerProps {
  jobId: string;
  status: JobStatus;
  error?: string | null;
}

export function AiJobStatusTracker({
  jobId,
  status,
  error,
}: AiJobStatusTrackerProps) {
  const steps = [
    {
      key: 'pending',
      label: 'Queuing Job',
      desc: 'Waiting for processor slot',
    },
    {
      key: 'processing',
      label: 'Processing LLM',
      desc: 'Querying model and formatting structured output',
    },
    { key: 'completed', label: 'Done', desc: 'Cards generated successfully' },
  ];

  const getStepState = (stepKey: string) => {
    if (status === 'failed' && stepKey === 'completed') return 'failed';
    if (status === stepKey) return 'active';

    const order = ['pending', 'processing', 'completed'];
    const currentIndex = order.indexOf(status);
    const stepIndex = order.indexOf(stepKey);

    if (currentIndex > stepIndex) return 'finished';
    return 'upcoming';
  };

  return (
    <div className="bg-card/30 border border-border/50 rounded-3xl p-6 backdrop-blur-md max-w-md mx-auto space-y-6 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-violet-500 via-indigo-500 to-amber-500 animate-pulse" />

      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold tracking-tight">
          Generating Your Deck
        </h3>
        <p className="text-xs text-muted-foreground font-mono">
          Job ID: {jobId}
        </p>
      </div>

      <div className="flex justify-center py-4">
        {status === 'failed' ? (
          <XCircle className="size-16 text-destructive animate-bounce" />
        ) : status === 'completed' ? (
          <CheckCircle2 className="size-16 text-emerald-500 animate-pulse" />
        ) : (
          <Loader2 className="size-16 text-violet-500 animate-spin" />
        )}
      </div>

      {/* Progress timeline */}
      <div className="space-y-4 relative">
        <div className="absolute left-3.75 top-3 bottom-3 w-0.5 bg-border/40" />

        {steps.map((step) => {
          const state = getStepState(step.key);
          return (
            <div key={step.key} className="flex gap-4 relative group">
              <div className="flex items-center justify-center z-10">
                {state === 'finished' && (
                  <div className="size-8 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center text-emerald-500 font-bold text-xs">
                    ✓
                  </div>
                )}
                {state === 'active' && (
                  <div className="size-8 rounded-full bg-violet-500/10 border-2 border-violet-500 flex items-center justify-center text-violet-500 font-bold text-xs animate-pulse">
                    ●
                  </div>
                )}
                {state === 'failed' && (
                  <div className="size-8 rounded-full bg-destructive/10 border-2 border-destructive flex items-center justify-center text-destructive font-bold text-xs">
                    ✕
                  </div>
                )}
                {state === 'upcoming' && (
                  <div className="size-8 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground font-semibold text-xs">
                    ○
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-semibold transition-colors duration-200 ${
                    state === 'active'
                      ? 'text-primary'
                      : state === 'finished'
                        ? 'text-foreground/80'
                        : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {status === 'failed' && error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-xs text-destructive text-center font-medium">
          Error: {error}
        </div>
      )}
    </div>
  );
}
