import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/PageContainer';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef } from 'react';

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

export function ReviewComplete({ onExit }: { onExit: () => void }) {
  return (
    <PageContainer className="max-w-3xl py-4 sm:py-6">
      <div className="flex min-h-80 flex-col items-center justify-center gap-4 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Review complete</h1>
          <p className="text-sm text-muted-foreground">
            All due cards in this deck are done for now.
          </p>
        </div>
        <Button onClick={onExit} className="cursor-pointer gap-1.5">
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Button>
      </div>
    </PageContainer>
  );
}
