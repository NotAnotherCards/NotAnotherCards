import assert from 'node:assert/strict';
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  checkDocument,
  expectedBlocks,
  readSnapshot,
  schemaDifferences,
  updateDocument,
} from './schema-docs.mjs';
import { loadSource } from './schema-source.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const { snapshot } = readSnapshot(resolve(root, 'apps/api/drizzle/meta'));
const { snapshot: source, localSchema } = loadSource(root);
const doc = readFileSync(resolve(root, 'docs/db-schemas.md'), 'utf8');
const expected = expectedBlocks(snapshot, localSchema);

test('the current document and snapshot agree with source', () => {
  assert.deepEqual(schemaDifferences(snapshot, source), []);
  assert.deepEqual(checkDocument(doc, expected), []);
  assert.equal(updateDocument(doc, expected), doc);
});

const changes = [
  [
    'table removed',
    (s) => {
      delete s.tables['public.ai_usage'];
    },
  ],
  [
    'table added',
    (s) => {
      s.tables['public.new_table'] = {
        ...structuredClone(s.tables['public.remelon_sync_meta']),
        name: 'new_table',
      };
    },
  ],
  [
    'column added',
    (s) => {
      s.tables['public.user'].columns.nickname = {
        name: 'nickname',
        type: 'text',
        primaryKey: false,
        notNull: false,
      };
    },
  ],
  [
    'column removed',
    (s) => {
      delete s.tables['public.user'].columns.image;
    },
  ],
  [
    'type',
    (s) => {
      s.tables['public.user'].columns.image.type = 'uuid';
    },
  ],
  [
    'nullability',
    (s) => {
      s.tables['public.user'].columns.image.notNull = true;
    },
  ],
  [
    'default',
    (s) => {
      s.tables['public.user'].columns.email_verified.default = true;
    },
  ],
  [
    'default removed',
    (s) => {
      delete s.tables['public.user'].columns.email_verified.default;
    },
  ],
  [
    'primary key',
    (s) => {
      s.tables['public.user'].columns.id.primaryKey = false;
    },
  ],
  [
    'composite primary key',
    (s) => {
      s.tables[
        'public.badge_awards'
      ].compositePrimaryKeys.badge_awards_user_code_pk.columns.reverse();
    },
  ],
  [
    'unique constraint',
    (s) => {
      delete s.tables['public.user'].uniqueConstraints.user_email_unique;
    },
  ],
  [
    'unique null semantics',
    (s) => {
      s.tables[
        'public.user'
      ].uniqueConstraints.user_email_unique.nullsNotDistinct = true;
    },
  ],
  [
    'foreign key destination',
    (s) => {
      s.tables[
        'public.session'
      ].foreignKeys.session_user_id_user_id_fk.tableTo = 'account';
    },
  ],
  [
    'foreign key delete action',
    (s) => {
      s.tables[
        'public.session'
      ].foreignKeys.session_user_id_user_id_fk.onDelete = 'restrict';
    },
  ],
  [
    'foreign key update action',
    (s) => {
      s.tables[
        'public.session'
      ].foreignKeys.session_user_id_user_id_fk.onUpdate = 'cascade';
    },
  ],
  [
    'index order',
    (s) => {
      s.tables[
        'public.user_decks'
      ].indexes.user_decks_user_rev_idx.columns.reverse();
    },
  ],
  [
    'index direction',
    (s) => {
      s.tables[
        'public.user_decks'
      ].indexes.user_decks_user_rev_idx.columns[0].asc = false;
    },
  ],
  [
    'index null ordering',
    (s) => {
      s.tables[
        'public.user_decks'
      ].indexes.user_decks_user_rev_idx.columns[0].nulls = 'first';
    },
  ],
  [
    'index method',
    (s) => {
      s.tables['public.user_decks'].indexes.user_decks_user_rev_idx.method =
        'hash';
    },
  ],
  [
    'index uniqueness',
    (s) => {
      s.tables['public.user_decks'].indexes.user_decks_user_rev_idx.isUnique =
        true;
    },
  ],
  [
    'index expression',
    (s) => {
      s.tables[
        'public.ai_generation_jobs'
      ].indexes.ai_jobs_active_deck_moderation_unique.columns[0].expression =
        '("payload" ->> \'otherId\')';
    },
  ],
  [
    'partial index predicate',
    (s) => {
      s.tables[
        'public.ai_generation_jobs'
      ].indexes.ai_jobs_active_deck_moderation_unique.where = 'false';
    },
  ],
  [
    'check expression without renaming',
    (s) => {
      s.tables[
        'public.review_events'
      ].checkConstraints.review_events_rating_check.value =
        '"review_events"."rating" between 1 and 5';
    },
  ],
  [
    'sequence',
    (s) => {
      s.sequences['public.remelon_rev'].increment = '2';
    },
  ],
  [
    'row-level security',
    (s) => {
      s.tables['public.user'].isRLSEnabled = true;
    },
  ],
];
for (const [name, mutate] of changes) {
  test(`rejects undocumented ${name} drift, and stale source/snapshot pairs`, () => {
    const changed = structuredClone(snapshot);
    mutate(changed);
    assert.ok(
      checkDocument(doc, expectedBlocks(changed, localSchema)).length > 0,
    );
    assert.ok(schemaDifferences(snapshot, changed).length > 0);
  });
}

test('keeps literal SQL values intact when checking expressions and defaults', () => {
  const changed = structuredClone(snapshot);
  changed.tables['public.user'].columns.timezone.default = "'Mixed  CASE'";
  const next = updateDocument(doc, expectedBlocks(changed, localSchema));
  assert.ok(next.includes("DEFAULT 'Mixed  CASE'"));
  assert.ok(
    checkDocument(
      next.replace("'Mixed  CASE'", "'mixed CASE'"),
      expectedBlocks(changed, localSchema),
    ).length,
  );
});

test('detects document-only drift and malformed, missing, duplicate or obsolete blocks', () => {
  assert.ok(
    checkDocument(doc.replace('DEFAULT false', 'DEFAULT true'), expected)
      .length,
  );
  assert.ok(
    checkDocument(
      doc.replace(
        '<!-- schema:table:public.user -->',
        '<!-- schema:table:public.unknown -->',
      ),
      expected,
    ).length,
  );
  const marker = '<!-- schema:table:public.user -->';
  assert.ok(
    checkDocument(doc.replace(marker, '<!-- typo -->'), expected).length,
  );
  const first = doc.match(
    /<!-- schema:table:public.user -->[\s\S]*?<!-- \/schema -->/,
  )[0];
  assert.ok(
    checkDocument(doc + '\n' + first, expected).some((p) =>
      p.startsWith('duplicate'),
    ),
  );
  assert.throws(() => updateDocument(doc + '\n' + first, expected));
});

for (const [name, mutate] of [
  [
    'version',
    (s) => {
      s.version += 1;
    },
  ],
  [
    'column type',
    (s) => {
      s.tables.user_decks.columns.title.type = 'number';
    },
  ],
  [
    'nullability',
    (s) => {
      s.tables.user_decks.columns.title.isOptional = true;
    },
  ],
  [
    'index',
    (s) => {
      s.tables.user_decks.columns.title.isIndexed = true;
    },
  ],
  [
    'registration',
    (s) => {
      delete s.tables.user_decks;
    },
  ],
]) {
  test(`detects local ${name} changes`, () => {
    const changed = structuredClone(localSchema);
    mutate(changed);
    assert.ok(checkDocument(doc, expectedBlocks(snapshot, changed)).length);
  });
}

test('ignores snapshot identity and object property order, but not definition changes', () => {
  const changed = structuredClone(snapshot);
  changed.id = 'new identity';
  changed.prevId = 'previous identity';
  changed.tables = Object.fromEntries(Object.entries(changed.tables).reverse());
  assert.deepEqual(schemaDifferences(snapshot, changed), []);
});

test('0016 preserves the moderation and gamification definitions from 0015', () => {
  const repaired = JSON.parse(
    readFileSync(
      resolve(root, 'apps/api/drizzle/meta/0016_snapshot.json'),
      'utf8',
    ),
  );
  const previous = JSON.parse(
    readFileSync(
      resolve(root, 'apps/api/drizzle/meta/0015_snapshot.json'),
      'utf8',
    ),
  );
  for (const name of [
    'badge_awards',
    'daily_challenge_completions',
    'deck_reports',
    'deck_takedowns',
    'published_decks',
    'ai_generation_jobs',
  ]) {
    assert.deepEqual(
      repaired.tables[`public.${name}`],
      previous.tables[`public.${name}`],
    );
  }
  // No SQL is needed for this repair: those definitions were already migrated.
  for (const [tag, table] of [
    ['0014', 'deck_reports'],
    ['0015', 'badge_awards'],
  ]) {
    const journal = JSON.parse(
      readFileSync(
        resolve(root, 'apps/api/drizzle/meta/_journal.json'),
        'utf8',
      ),
    );
    const migration = journal.entries.find(
      (entry) => String(entry.idx).padStart(4, '0') === tag,
    );
    assert.ok(
      readFileSync(
        resolve(root, `apps/api/drizzle/${migration.tag}.sql`),
        'utf8',
      ).includes(`CREATE TABLE "${table}"`),
    );
  }
});

test('CLI catches source-only edits without generating files or trusting stale builds', () => {
  const copy = mkdtempSync(join(tmpdir(), 'schema-docs-test-'));
  try {
    for (const dir of [
      'apps/api/src',
      'apps/api/drizzle',
      'packages/offline-db/src',
      'scripts',
    ]) {
      mkdirSync(resolve(copy, dir, '..'), { recursive: true });
      cpSync(resolve(root, dir), resolve(copy, dir), { recursive: true });
    }
    for (const path of [
      'apps/api/package.json',
      'apps/api/drizzle.config.ts',
      'packages/offline-db/package.json',
    ])
      cpSync(resolve(root, path), resolve(copy, path));
    for (const path of [
      'apps/api/node_modules',
      'packages/offline-db/node_modules',
    ])
      symlinkSync(resolve(root, path), resolve(copy, path), 'dir');
    const run = () =>
      spawnSync(
        process.execPath,
        [resolve(copy, 'scripts/check-schema-fresh.mjs')],
        { encoding: 'utf8' },
      );
    const baseline = run();
    assert.equal(baseline.status, 0, baseline.stderr);
    const schemaFile = resolve(copy, 'apps/api/src/database/schema.ts');
    const schemaSource = readFileSync(schemaFile, 'utf8');
    writeFileSync(
      schemaFile,
      schemaSource.replace(
        "emailVerified: boolean('email_verified').default(false)",
        "emailVerified: boolean('email_verified').default(true)",
      ),
    );
    const result = run();
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /user.columns.email_verified.default/,
      JSON.stringify(result),
    );
    assert.match(result.stderr, /snapshot=false, source=true/);
    assert.equal(
      readFileSync(
        resolve(copy, 'apps/api/drizzle/meta/_journal.json'),
        'utf8',
      ),
      readFileSync(
        resolve(root, 'apps/api/drizzle/meta/_journal.json'),
        'utf8',
      ),
    );
    writeFileSync(schemaFile, schemaSource);
    const restored = run();
    assert.equal(restored.status, 0, restored.stderr);
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
});
