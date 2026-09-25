// Read-only comparison; never generates a migration or connects to a DB.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSnapshot, schemaDifferences } from './schema-docs.mjs';
import { loadSource } from './schema-source.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
try {
  const { latest, snapshot } = readSnapshot(
    resolve(root, 'apps/api/drizzle/meta'),
  );
  const { snapshot: source } = loadSource(root);
  const differences = schemaDifferences(snapshot, source);
  if (differences.length) {
    throw new Error(
      `Drizzle snapshot ${latest} differs from schema source:\n${differences.join('\n')}\nGenerate and review the migration/snapshot, then update docs/db-schemas.md. Do not generate duplicate SQL for changes already present in migration history.`,
    );
  }
  console.log(`Drizzle snapshot ${latest} matches the current schema source.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
