import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/PageContainer';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type DeleteConfirmationDialogProps = {
  onCancel: () => void;
  onConfirm: () => void;
  error: string | null;
  isDeleting: boolean;
};

export function DeleteConfirmationDialog({
  onCancel,
  onConfirm,
  error,
  isDeleting,
}: DeleteConfirmationDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-word-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
          } else if (event.key === 'Tab') {
            event.preventDefault();
            event.stopPropagation();

            const nextButton =
              document.activeElement === cancelButtonRef.current
                ? confirmButtonRef.current
                : cancelButtonRef.current;
            nextButton?.focus();
          } else if (
            event.key === 'ArrowLeft' ||
            event.key === 'ArrowRight' ||
            event.key === 'ArrowUp' ||
            event.key === 'ArrowDown'
          ) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        className="w-full rounded-3xl border border-border/80 bg-background p-5 shadow-2xl sm:max-w-lg sm:p-6"
      >
        <h2 id="delete-word-title" className="text-xl font-bold">
          Does permanently delete this word?
        </h2>
        {error && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button
            ref={cancelButtonRef}
            variant="outline"
            onClick={onCancel}
            disabled={isDeleting}
            className="min-h-12 cursor-pointer"
          >
            No
          </Button>
          <Button
            ref={confirmButtonRef}
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            className="min-h-12 cursor-pointer"
          >
            Yes
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ActivateMoreWords({
  onActivate,
  onExit,
  initialCount,
}: {
  onActivate: (count: number) => Promise<void>;
  onExit: () => void;
  initialCount: number;
}) {
  const [count, setCount] = useState(initialCount);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium" htmlFor="activation-count">
        Activate more words
      </label>
      <input
        id="activation-count"
        type="number"
        min="1"
        value={count}
        onChange={(event) => setCount(Math.max(1, Number(event.target.value) || 1))}
        className="w-24 rounded-md border bg-background px-3 py-2 text-center"
      />
      <Button
        onClick={async () => {
          setIsSaving(true);
          setError(null);
          try {
            await onActivate(Math.max(1, Math.floor(count)));
          } catch {
            setError('An error occurred while activating words. Please try again.');
          } finally {
            setIsSaving(false);
          }
        }}
        disabled={isSaving}
        className="cursor-pointer"
      >
        Activate and continue
      </Button>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button variant="outline" onClick={onExit} className="cursor-pointer">
        Back to dashboard
      </Button>
    </div>
  );
}

export function ReviewComplete({
  onExit,
  onActivate,
  activationCount,
}: {
  onExit: () => void;
  onActivate?: (count: number) => Promise<void>;
  activationCount?: number;
}) {
  return (
    <PageContainer className="max-w-3xl py-4 sm:py-6">
      <div className="flex min-h-80 flex-col items-center justify-center gap-4 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Review complete</h1>
          <p className="text-sm text-muted-foreground">
            All due cards in this deck are done for now.
          </p>
        </div>
        {onActivate && activationCount ? (
          <ActivateMoreWords
            onActivate={onActivate}
            onExit={onExit}
            initialCount={activationCount}
          />
        ) : (
          <Button onClick={onExit} className="cursor-pointer gap-1.5">
          <ArrowLeft className="size-4" />
          Back to dashboard
          </Button>
        )}
      </div>
    </PageContainer>
  );
}
