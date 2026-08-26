import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
vi.unmock('@/offline/db');

type StubManager = {
  state: { status: string; error: null };
  init: Mock<() => Promise<unknown>>;
  close: Mock<() => Promise<void>>;
  subscribe: Mock<() => () => void>;
};

// `var` is intentional: Vitest hoists mock factories before lexical variable
// initialization (same pattern as db.test.ts).
// eslint-disable-next-line no-var
var stubManagers: StubManager[] = [];
// eslint-disable-next-line no-var
var closeFailure: Error | null = null;

vi.mock('@remelondb/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@remelondb/core')>();
  const fakeDb = {
    get: () => ({ query: () => ({ fetch: async () => [] }) }),
  };
  return {
    ...actual,
    createDatabaseManager: vi.fn(() => {
      const stub: StubManager = {
        state: { status: 'idle', error: null },
        init: vi.fn(async () => {
          stub.state = { status: 'ready', error: null };
          return fakeDb;
        }),
        close: vi.fn(async () => {
          stub.state = { status: 'idle', error: null };
          if (closeFailure) {
            throw closeFailure;
          }
        }),
        subscribe: vi.fn(() => () => {}),
      };
      stubManagers.push(stub);
      return stub;
    }),
  };
});

vi.mock('@remelondb/driver-web', () => ({
  WebSqliteDriver: class {},
}));

const loadSubject = () => import('../offline/db');

describe('database manager ownership (issue #140)', () => {
  beforeEach(() => {
    vi.resetModules();
    stubManagers = [];
    closeFailure = null;
  });

  it('a failed close still clears the global', async () => {
    const db = await loadSubject();

    db.createUserDatabaseManager('user-a');
    const activeStub = stubManagers[0];
    await activeStub.init();

    closeFailure = new Error('driver close failed');
    await expect(db.closeUserDatabase()).rejects.toThrow('driver close failed');
    // The global only ever holds a manager nobody has tried to close.
    expect(db.manager).toBeNull();
  });

  it('closing a specific manager clears the global only when it is still active', async () => {
    const db = await loadSubject();

    const first = db.createUserDatabaseManager('user-a');
    const second = db.createUserDatabaseManager('user-a');

    // Closing the displaced first manager leaves the successor active.
    await db.closeUserDatabase(first);
    expect(db.manager).toBe(second);

    // Closing the active manager clears the global.
    await db.closeUserDatabase(second);
    expect(db.manager).toBeNull();
  });
});
