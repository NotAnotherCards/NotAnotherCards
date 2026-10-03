import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/PageContainer';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
          {t(
            'review.dialogs.delete_word_title',
            'Permanently delete this word?',
          )}
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
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            ref={confirmButtonRef}
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            className="min-h-12 cursor-pointer"
          >
            {t('review.dialogs.delete_confirmation', 'Delete')}
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
  inactiveItemCount,
  itemLabel,
}: {
  onActivate: (count: number) => Promise<void>;
  onExit: () => void;
  initialCount: number;
  inactiveItemCount?: number;
  itemLabel?: 'words' | 'cards';
}) {
  const { t } = useTranslation();
  const maxCount = Math.max(1, inactiveItemCount ?? Number.MAX_SAFE_INTEGER);
  const [count, setCount] = useState(() =>
    String(Math.min(maxCount, Math.max(1, initialCount))),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedCount = () => {
    const value = Number(count);
    if (!Number.isInteger(value) || value < 1) return null;
    return Math.min(maxCount, value);
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-4 text-sm font-medium">
        <label htmlFor="activation-count">
          {t('review.activation.activate', 'Activate')}
        </label>
        <input
          id="activation-count"
          type="number"
          min="1"
          step="1"
          max={inactiveItemCount}
          ref={inputRef}
          value={count}
          onChange={(event) => setCount(event.target.value)}
          className="w-14 rounded-md border bg-background px-2 py-2 text-center"
        />
        <span>
          {t(
            `review.activation.available_${itemLabel === 'cards' ? 'cards' : 'words'}`,
            { count: inactiveItemCount ?? 0 },
          )}
        </span>
      </div>
      <Button
        onClick={async () => {
          const value = selectedCount();
          if (value === null) {
            inputRef.current?.reportValidity();
            return;
          }
          setIsSaving(true);
          setError(null);
          try {
            await onActivate(value);
          } catch {
            setError(
              t('review.activation.error', 'Activation error. Try again.'),
            );
          } finally {
            setIsSaving(false);
          }
        }}
        disabled={isSaving}
        className="cursor-pointer"
      >
        {t('review.activation.continue', 'Activate and continue')}
      </Button>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button variant="outline" onClick={onExit} className="cursor-pointer">
        {t('review.session.back_to_dashboard', 'Back to dashboard')}
      </Button>
    </div>
  );
}

export function ReviewComplete({
  onExit,
  onActivate,
  activationCount,
  inactiveItemCount = 0,
  itemLabel = 'words',
}: {
  onExit: () => void;
  onActivate?: (count: number) => Promise<void>;
  activationCount?: number;
  inactiveItemCount: number;
  itemLabel: 'words' | 'cards';
}) {
  const { t } = useTranslation();
  return (
    <PageContainer className="max-w-3xl py-4 sm:py-6">
      <div className="flex min-h-80 flex-col items-center justify-center gap-4 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">
            {t('review.activation.complete_title', 'Review complete')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              'review.activation.complete_description',
              'All due cards in this deck are done for now.',
            )}
          </p>
        </div>
        {onActivate && activationCount ? (
          <ActivateMoreWords
            onActivate={onActivate}
            onExit={onExit}
            initialCount={activationCount}
            inactiveItemCount={inactiveItemCount}
            itemLabel={itemLabel}
          />
        ) : (
          <Button onClick={onExit} className="cursor-pointer gap-1.5">
            <ArrowLeft className="size-4" />
            {t('review.session.back_to_dashboard', 'Back to dashboard')}
          </Button>
        )}
      </div>
    </PageContainer>
  );
}
