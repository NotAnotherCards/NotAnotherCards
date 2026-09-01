import { Link } from '@tanstack/react-router';

export function NotFoundComponent() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background text-foreground text-center">
      <h1 className="text-4xl font-extrabold mb-2 tracking-tight">404</h1>
      <p className="text-muted-foreground mb-6">Page not found</p>
      <Link
        to="/"
        className="px-4 py-2 rounded-3xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
      >
        Go Home
      </Link>
    </div>
  );
}
