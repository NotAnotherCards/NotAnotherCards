import "@testing-library/jest-dom/vitest";
import { vi, afterEach } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
});

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

// Mock window.scrollTo since it is not implemented in JSDOM
window.scrollTo = vi.fn();

// Mock window.matchMedia since next-themes relies on it and it's not implemented in JSDOM
Object.defineProperty(window, "matchMedia", {
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

