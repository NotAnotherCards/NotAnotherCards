import { useEffect, useRef, type ReactNode } from 'react';
import { Card } from '@/components/ui/card';

interface WordNoteDialogProps {
  children: ReactNode;
  label: string;
  onClose: () => void;
}

export function WordNoteDialog({
  children,
  label,
  onClose,
}: WordNoteDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  // Parent components recreate callbacks during store updates. Keep the
  // latest close action without treating that update as a newly opened dialog.
  onCloseRef.current = onClose;

  useEffect(() => {
    const activeElement = document.activeElement;
    const previousFocus =
      activeElement instanceof HTMLElement ? activeElement : null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, []);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <Card
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-lg border border-border/80 shadow-2xl animate-in zoom-in-95 duration-200"
      >
        {children}
      </Card>
    </div>
  );
}
