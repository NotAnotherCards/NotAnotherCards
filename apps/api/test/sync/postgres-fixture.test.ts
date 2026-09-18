import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const pool = () => ({
    query: vi.fn(),
    end: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  });
  return { admin: pool(), test: pool() };
});

vi.mock('dotenv/config', () => ({}));
vi.mock('pg', () => ({
  Pool: vi.fn(function () {
    return mocks.admin.on.mock.calls.length === 0 ? mocks.admin : mocks.test;
  }),
}));
vi.mock('drizzle-orm/node-postgres', () => ({ drizzle: vi.fn() }));
vi.mock('drizzle-orm/node-postgres/migrator', () => ({ migrate: vi.fn() }));

describe('PostgreSQL fixture teardown', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubEnv(
      'TEST_DATABASE_URL',
      'postgresql://test:test@localhost/postgres',
    );
    mocks.admin.query.mockReset();
    mocks.admin.query.mockResolvedValue({ rows: [{ count: '0' }] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  async function fixture() {
    const fixture = await import('./postgres-fixture.js');
    await fixture.setUpPostgres();
    mocks.admin.query.mockClear();
    return fixture;
  }

  it('waits for server backends after pool.end resolves and drops without force', async () => {
    const { tearDownPostgres } = await fixture();
    mocks.admin.query
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const teardown = tearDownPostgres();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.test.end).toHaveBeenCalledOnce();
    expect(mocks.admin.query).toHaveBeenCalledTimes(1);
    expect(mocks.admin.query).toHaveBeenLastCalledWith(
      'SELECT count(*) FROM pg_stat_activity WHERE datname = $1',
      [expect.stringMatching(/^notanothercards_sync_/)],
    );
    await vi.advanceTimersByTimeAsync(10);
    expect(mocks.admin.query).toHaveBeenCalledTimes(2);
    expect(mocks.admin.end).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10);
    await teardown;

    expect(mocks.admin.query).toHaveBeenLastCalledWith(
      expect.stringMatching(/^DROP DATABASE "notanothercards_sync_[^"]+"$/),
    );
    expect(mocks.admin.end).toHaveBeenCalledOnce();
  });

  it('logs remaining backends before terminating them only after the deadline', async () => {
    const { tearDownPostgres } = await fixture();
    const backends = [
      { pid: 123, application_name: 'leaked-test', state: 'idle' },
    ];
    mocks.admin.query.mockImplementation((sql: string) =>
      Promise.resolve({
        rows: sql.startsWith('SELECT count') ? [{ count: '1' }] : backends,
      }),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const teardown = tearDownPostgres();
    await vi.advanceTimersByTimeAsync(4_990);
    expect(warn).not.toHaveBeenCalled();
    expect(mocks.admin.end).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10);
    await teardown;

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('forcing cleanup'),
      backends,
    );
    const queries = mocks.admin.query.mock.calls.map(([sql]) => sql as string);
    expect(queries.slice(-3)).toEqual([
      expect.stringContaining('SELECT pid, application_name'),
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1',
      expect.stringMatching(/WITH \(FORCE\)$/),
    ]);
    expect(mocks.admin.end).toHaveBeenCalledOnce();
  });

  it('closes the admin pool and reports a failed normal drop without forcing it', async () => {
    const { tearDownPostgres } = await fixture();
    const error = new Error('drop failed');
    mocks.admin.query
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockRejectedValueOnce(error);
    await expect(tearDownPostgres()).rejects.toBe(error);
    expect(mocks.admin.end).toHaveBeenCalledOnce();
    expect(mocks.admin.query).toHaveBeenCalledTimes(2);
  });

  it('only absorbs pool errors during teardown', async () => {
    const { tearDownPostgres } = await fixture();
    const handler = mocks.test.on.mock.calls[0][1] as (error: Error) => void;
    const error = new Error('connection failed');
    expect(() => handler(error)).toThrow(error);
    await tearDownPostgres();
    expect(() => handler(error)).not.toThrow();
  });
});
