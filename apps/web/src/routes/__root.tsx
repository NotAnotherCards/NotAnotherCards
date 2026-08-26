import { Outlet, createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { ThemeProvider } from 'next-themes';
import { SessionDatabaseProvider } from '@/offline/sessionDatabase';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  // The database provider belongs here, above every route, not inside
  // the `/app` layout: it holds the queue that makes the next open wait
  // for the previous close, and a route layout is destroyed and rebuilt
  // on navigation.
  return (
    <ThemeProvider attribute="class">
      <SessionDatabaseProvider>
        <main>
          <Outlet />
        </main>
      </SessionDatabaseProvider>
      <TanStackRouterDevtools />
    </ThemeProvider>
  );
}
