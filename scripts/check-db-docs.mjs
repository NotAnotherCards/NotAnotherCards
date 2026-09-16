// docs/db-schemas.md must name every server table and column that exists.
// drizzle-kit writes a snapshot of the whole schema next to each migration;
// the latest one is the truth this compares the doc against (#360).
//
// Scope: table and column names under "## Current architecture", plus a
// column's type and its NOT NULL / NULL marker where the document states
// them. Indexes, constraints, foreign keys and defaults are prose in that
// document, so they stay with the pull-request checklist and review; the
// offline (remelonDB) schema is not checked here either.
// scripts/check-schema-fresh.mjs makes sure the snapshot itself is current.
import { readFileSync } from 'node:fs';

const docPath = process.argv[2] ?? 'docs/db-schemas.md';
const metaDir = process.argv[3] ?? 'apps/api/drizzle/meta';

const journal = JSON.parse(readFileSync(`${metaDir}/_journal.json`, 'utf8'));
const latest = String(journal.entries.at(-1).idx).padStart(4, '0');
const snapshot = JSON.parse(
  readFileSync(`${metaDir}/${latest}_snapshot.json`, 'utf8'),
);
// The document spells types the way a reader says them; the snapshot uses
// PostgreSQL's own names. Only the pairs listed here are compared; a type
// the document words differently is reported so the mapping can grow.
const typeWords = new Map([
  ['text', 'text'],
  ['integer', 'integer'],
  ['bigint', 'bigint'],
  ['boolean', 'boolean'],
  ['uuid', 'uuid'],
  ['jsonb', 'jsonb'],
  ['date', 'date'],
  ['timestamptz', 'timestamp with time zone'],
  ['timestamp', 'timestamp'],
  ['number', 'double precision'],
]);

const actual = new Map(
  Object.values(snapshot.tables).map((table) => [
    table.name,
    new Map(
      Object.values(table.columns).map((column) => [
        column.name,
        { type: column.type, notNull: column.notNull === true },
      ]),
    ),
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
  const columns = new Map();
  for (const line of match[3].split('\n')) {
    const [name, typeWord] = line.trim().split(/\s+/);
    if (!name || /^(INDEX|UNIQUE|CHECK|PRIMARY|FOREIGN)\b/.test(name)) continue;
    const rest = line.slice(line.indexOf(name) + name.length);
    columns.set(name, {
      typeWord,
      // "NOT NULL" and a bare "NULL" are the two markers the document uses;
      // a line that states neither (a primary key, say) is not compared.
      notNull: /\bNOT NULL\b/.test(rest)
        ? true
        : /\bNULL\b/.test(rest)
          ? false
          : undefined,
    });
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
  for (const [column, actualColumn] of columns) {
    const documentedColumn = docColumns.get(column);
    if (!documentedColumn) {
      problems.push(`${table}.${column} exists but is not documented`);
      continue;
    }
    const expectedType = typeWords.get(documentedColumn.typeWord);
    if (expectedType === undefined) {
      problems.push(
        `${table}.${column} is documented as "${documentedColumn.typeWord}", ` +
          `which scripts/check-db-docs.mjs does not know; add it to typeWords ` +
          `(the schema says ${actualColumn.type})`,
      );
    } else if (expectedType !== actualColumn.type) {
      problems.push(
        `${table}.${column} is ${actualColumn.type} but documented as ` +
          `${documentedColumn.typeWord}`,
      );
    }
    if (
      documentedColumn.notNull !== undefined &&
      documentedColumn.notNull !== actualColumn.notNull
    ) {
      problems.push(
        `${table}.${column} is ${actualColumn.notNull ? 'NOT NULL' : 'nullable'} ` +
          `but documented as ${documentedColumn.notNull ? 'NOT NULL' : 'NULL'}`,
      );
    }
  }
  for (const column of docColumns.keys()) {
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
