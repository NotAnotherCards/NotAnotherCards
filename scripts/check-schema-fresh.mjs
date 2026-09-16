// The drizzle snapshot must match the schema source (#360).
//
// docs/db-schemas.md is checked against the newest snapshot in
// apps/api/drizzle/meta, so a schema change that was never turned into a
// migration would leave both the snapshot and the doc stale and pass.
// Running the generator and requiring it to produce nothing closes that:
// if apps/api/src/**/schema.ts moved ahead of the migrations, drizzle-kit
// writes a new migration and snapshot here, and the check fails.
import { execFileSync } from 'node:child_process';

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

// drizzle.config.ts imports the api's schema, which imports @repo/offline-db
// constants, so the package has to be built before the generator runs.
run('pnpm', ['--filter', '@repo/offline-db', 'build']);
const generated = run('pnpm', [
  '--filter',
  'api',
  'exec',
  'drizzle-kit',
  'generate',
  '--config',
  'drizzle.config.ts',
]);

const changes = run('git', [
  'status',
  '--porcelain',
  'apps/api/drizzle',
]).trim();
if (changes) {
  console.error(
    'The drizzle schema and its migrations disagree. Running ' +
      '`pnpm --filter api db:generate` produced:\n' +
      changes +
      '\nCommit the generated migration and snapshot, and update ' +
      'docs/db-schemas.md in the same change.',
  );
  process.exit(1);
}
console.log(generated.trim().split('\n').at(-1) ?? 'schema is up to date');
