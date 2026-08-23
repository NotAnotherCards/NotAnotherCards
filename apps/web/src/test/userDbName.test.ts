import { userDbName } from '@repo/offline-db';
import { describe, expect, it } from 'vitest';

describe('userDbName', () => {
  it('is deterministic and well-formed', () => {
    expect(userDbName('abc123')).toBe(userDbName('abc123'));
    expect(userDbName('abc123')).toMatch(/^user_[0-9a-f]+\.db$/);
  });

  it('maps distinct ASCII ids to distinct names', () => {
    expect(userDbName('userA')).not.toBe(userDbName('userB'));
  });

  it('does not collide on non-BMP ids that share a UTF-16 high surrogate', () => {
    // 😀 (U+1F600) and 😁 (U+1F601) both begin with the high surrogate
    // D83D. A charCodeAt(0)-based encoding collapses each to "d83d" and
    // collides; encoding the full UTF-8 bytes keeps them distinct. This is
    // the exact bug that would let two accounts share one OPFS database.
    expect(userDbName('😀')).not.toBe(userDbName('😁'));
  });

  it('hex-encodes the complete UTF-8 representation', () => {
    expect(userDbName('café')).toBe('user_636166c3a9.db');
    expect(userDbName('😀')).toBe('user_f09f9880.db');
  });

  it('keeps a batch of varied ids all distinct', () => {
    const ids = [
      'a',
      'b',
      'userA',
      'userB',
      '😀',
      '😁',
      '🙂',
      'café',
      'cafe',
      'user_😀',
    ];
    const names = new Set(ids.map(userDbName));
    expect(names.size).toBe(ids.length);
  });
});
