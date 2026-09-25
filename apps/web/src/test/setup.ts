import '@testing-library/jest-dom/vitest';
import { vi, afterEach } from 'vitest';
import { useEffect, useState, useCallback } from 'react';
import '@/lib/i18n';

afterEach(() => {
  vi.restoreAllMocks();
});

// Mock authClient globally for all tests
vi.mock('@/lib/auth-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-client')>();
  return {
    ...actual,
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
        social: vi.fn(() => Promise.resolve({ data: null, error: null })),
      },
      signUp: {
        email: vi.fn(() => Promise.resolve({ data: null, error: null })),
      },
      requestPasswordReset: vi.fn(() =>
        Promise.resolve({ data: null, error: null }),
      ),
      resetPassword: vi.fn(() => Promise.resolve({ data: null, error: null })),
      changePassword: vi.fn(() => Promise.resolve({ data: null, error: null })),
      listAccounts: vi.fn(() =>
        Promise.resolve({
          data: [{ id: 'account-1', providerId: 'credential' }],
          error: null,
        }),
      ),
      twoFactor: {
        enable: vi.fn(() => Promise.resolve({ data: null, error: null })),
        disable: vi.fn(() => Promise.resolve({ data: null, error: null })),
        verifyTotp: vi.fn(() => Promise.resolve({ data: null, error: null })),
        verifyBackupCode: vi.fn(() =>
          Promise.resolve({ data: null, error: null }),
        ),
        generateBackupCodes: vi.fn(() =>
          Promise.resolve({ data: null, error: null }),
        ),
      },
      signOut: vi.fn(() => Promise.resolve({ data: null, error: null })),
    },
    checkUsernameAvailable: vi.fn(actual.checkUsernameAvailable),
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

// Mock @tanstack/react-virtual for JSDOM
vi.mock('@tanstack/react-virtual', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-virtual')>();

  return {
    ...actual,
    useVirtualizer: vi.fn().mockImplementation((options) => {
      // A simplistic stateful mock of the virtualizer's start index
      const [startIndex, setStartIndex] = useState(0);

      const estimateSize = options.estimateSize?.() ?? 61;
      const overscan = options.overscan ?? 5;
      const maxVisible = Math.min(options.count - startIndex, 10 + overscan);

      const items = Array.from({ length: maxVisible }, (_, i) => {
        const index = startIndex + i;
        return {
          index: index,
          start: index * estimateSize,
          size: estimateSize,
          end: (index + 1) * estimateSize,
          key: options.getItemKey ? options.getItemKey(index) : index,
          lane: 0,
        };
      });

      const scrollToIndex = useCallback(
        (index: number) => {
          setStartIndex(Math.min(index, Math.max(0, options.count - 1)));
        },
        [options.count],
      );

      return {
        getVirtualItems: () => items,
        getTotalSize: () => options.count * estimateSize,
        measureElement: vi.fn(),
        measure: vi.fn(),
        scrollToIndex,
        scrollToOffset: vi.fn(),
      };
    }),
  };
});
