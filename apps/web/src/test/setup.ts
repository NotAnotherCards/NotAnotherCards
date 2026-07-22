import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock authClient globally for all tests
vi.mock("@/lib/auth-client", () => {
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
      signOut: vi.fn(() => Promise.resolve({ data: null, error: null })),
    },
  };
});
