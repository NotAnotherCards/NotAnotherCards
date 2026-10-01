import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkDocument,
  expectedBlocks,
  readSnapshot,
  updateDocument,
} from './schema-docs.mjs';
import { loadSource } from './schema-source.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const docPath = resolve(root, 'docs/db-schemas.md');
try {
  const { latest, snapshot } = readSnapshot(
    resolve(root, 'apps/api/drizzle/meta'),
  );
  const { localSchema } = loadSource(root);
  const expected = expectedBlocks(snapshot, localSchema);
  const doc = readFileSync(docPath, 'utf8');
  if (process.argv.includes('--write')) {
    writeFileSync(docPath, updateDocument(doc, expected));
    console.log(
      'Updated schema blocks; review the accompanying prose and proposals.',
    );
  } else {
    const problems = checkDocument(doc, expected);
    if (problems.length)
      throw new Error(
        problems.join('\n') +
          '\nRun pnpm docs:db:generate and review the diff.',
      );
    console.log(
      `Database docs match snapshot ${latest} and local schema (${Object.keys(snapshot.tables).length} server tables).`,
    );
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
