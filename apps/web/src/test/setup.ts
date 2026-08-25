import '@testing-library/jest-dom/vitest';
import { vi, afterEach } from 'vitest';
import { useEffect, useState } from 'react';

afterEach(() => {
  vi.restoreAllMocks();
});

// Mock authClient globally for all tests
vi.mock('@/lib/auth-client', () => {
  return {
    authClient: {
      getSession: vi.fn(() => Promise.resolve({ data: null, error: null })),
      useSession: vi.fn(() => ({
        data: null,
        isPending: false,
        isRefetching: false,
        error: null,
        refetch: vi.fn(),
      })),
      signIn: {
        email: vi.fn(() => Promise.resolve({ data: null, error: null })),
      },
      signUp: {
        email: vi.fn(() => Promise.resolve({ data: null, error: null })),
      },
      requestPasswordReset: vi.fn(() =>
        Promise.resolve({ data: null, error: null }),
      ),
      resetPassword: vi.fn(() => Promise.resolve({ data: null, error: null })),
      changePassword: vi.fn(() => Promise.resolve({ data: null, error: null })),
      signOut: vi.fn(() => Promise.resolve({ data: null, error: null })),
    },
  };
});

// Mock window.scrollTo since it is not implemented in JSDOM
window.scrollTo = vi.fn();

// Mock window.matchMedia since next-themes relies on it and it's not implemented in JSDOM
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock useDatabaseState to avoid Worker errors in tests
vi.mock('@remelondb/core/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@remelondb/core/react')>();
  return {
    ...actual,
    useDatabaseState: vi.fn((mgr) => {
      if (!mgr) {
        return actual.useDatabaseState();
      }

      // We need local React hooks since this is inside a factory function
      const [localState, setLocalState] = useState(() => ({
        status: mgr?.state?.status || 'idle',
        error: mgr?.state?.error || null,
      }));

      useEffect(() => {
        const interval = setInterval(() => {
          const status = mgr.state?.status || 'idle';
          const error = mgr.state?.error || null;
          setLocalState((prev: { status: string; error: unknown }) => {
            if (prev.status === status && prev.error === error) return prev;
            return { status, error };
          });
        }, 10);
        return () => clearInterval(interval);
      }, [mgr]);

      return localState;
    }),
  };
});

// Mock @/offline/db globally to avoid cross-file mock pollution
vi.mock('@/offline/db', () => {
  const manager = {
    init: vi.fn().mockResolvedValue(undefined),
    state: { status: 'ready' },
  };
  return {
    manager,
    createUserDatabaseManager: vi.fn(() => manager),
    closeUserDatabase: vi.fn().mockResolvedValue(undefined),
  };
});
