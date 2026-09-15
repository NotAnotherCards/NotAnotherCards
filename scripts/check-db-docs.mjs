// docs/db-schemas.md must name every server table and column that exists.
// drizzle-kit writes a snapshot of the whole schema next to each migration;
// the latest one is the truth this compares the doc against (#360).
//
// Scope: table and column names under "## Current architecture". Types,
// indexes, constraints and the offline (remelonDB) schema are not checked.
import { readFileSync } from 'node:fs';

const docPath = process.argv[2] ?? 'docs/db-schemas.md';
const metaDir = process.argv[3] ?? 'apps/api/drizzle/meta';

const journal = JSON.parse(readFileSync(`${metaDir}/_journal.json`, 'utf8'));
const latest = String(journal.entries.at(-1).idx).padStart(4, '0');
const snapshot = JSON.parse(
  readFileSync(`${metaDir}/${latest}_snapshot.json`, 'utf8'),
);
const actual = new Map(
  Object.values(snapshot.tables).map((table) => [
    table.name,
    new Set(Object.keys(table.columns)),
  ]),
);

// A documented table is a `#### \`name\`` heading followed by a ```text
// block whose lines start with the column name. INDEX/UNIQUE/CHECK lines
// describe constraints, not columns. Only the current-architecture part
// counts; "Future ideas" may describe tables that do not exist yet.
const doc = readFileSync(docPath, 'utf8').split(/^## Future ideas/m)[0];
const documented = new Map();
const tableBlock =
  /^#### `([a-z_]+)`[^\n]*\n((?:(?!^#### )[\s\S])*?)```text\n([\s\S]*?)```/gm;
for (const match of doc.matchAll(tableBlock)) {
  const columns = new Set();
  for (const line of match[3].split('\n')) {
    const word = line.trim().split(/\s+/)[0];
    if (word && !/^(INDEX|UNIQUE|CHECK|PRIMARY|FOREIGN)\b/.test(word)) {
      columns.add(word);
    }
  }
  documented.set(match[1], columns);
}

const problems = [];
for (const [table, columns] of actual) {
  const docColumns = documented.get(table);
  if (!docColumns) {
    problems.push(`table ${table} is not documented`);
    continue;
  }
  for (const column of columns) {
    if (!docColumns.has(column)) {
      problems.push(`${table}.${column} exists but is not documented`);
    }
  }
  for (const column of docColumns) {
    if (!columns.has(column)) {
      problems.push(`${table}.${column} is documented but does not exist`);
    }
  }
}
for (const table of documented.keys()) {
  if (!actual.has(table)) {
    problems.push(
      `table ${table} is documented as current but is not in the schema`,
    );
  }
}

if (problems.length > 0) {
  console.error(
    `docs/db-schemas.md disagrees with drizzle snapshot ${latest}:\n` +
      problems.map((problem) => `  ${problem}`).join('\n'),
  );
  process.exit(1);
}
console.log(
  `docs/db-schemas.md matches drizzle snapshot ${latest} (${actual.size} tables)`,
);
