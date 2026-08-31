import { ErrorComponentProps, useRouter } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

export function RouteErrorComponent({ error }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background text-foreground text-center">
      <div className="max-w-md w-full p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4 flex flex-col items-center">
        <div className="p-3 rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="size-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight">Session Error</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {error?.message || 'An error occurred while loading your session.'}
          </p>
        </div>
        <div className="pt-2 w-full">
          <Button
            onClick={() => {
              void router.invalidate();
            }}
            variant="default"
            className="w-full sm:w-auto flex items-center justify-center gap-2 mx-auto"
          >
            <RefreshCw className="size-4" />
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}
