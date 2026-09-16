// docs/db-schemas.md must name every server table and column that exists.
// drizzle-kit writes a snapshot of the whole schema next to each migration;
// the latest one is the truth this compares the doc against (#360).
//
// Scope: under "## Current architecture", every table, its columns with
// their type and NOT NULL / NULL marker, its indexes, unique indexes,
// composite primary keys, foreign keys and the NAMES of its check
// constraints. A check's expression stays prose for the reader; the name is
// what this compares, so the document reads
// `CHECK user_decks_visibility_check: visibility in ('private', 'public')`.
// Column defaults and the offline (remelonDB) schema are not checked.
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

// The snapshot quotes identifiers as PostgreSQL does; the document spells
// them the way a reader would.
const plainSql = (sql) =>
  sql
    .replace(/"[a-z_]+"\."([a-z_]+)"/g, '$1')
    .replace(/"/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const columnList = (columns) =>
  columns.map((column) => column.expression ?? column).join(', ');

const actual = new Map(
  Object.values(snapshot.tables).map((table) => [
    table.name,
    {
      columns: new Map(
        Object.values(table.columns).map((column) => [
          column.name,
          { type: column.type, notNull: column.notNull === true },
        ]),
      ),
      // Index and key names are generated; the shape is what a reader needs.
      structure: new Set([
        ...Object.values(table.indexes ?? {}).map(
          (index) =>
            `${index.isUnique ? 'UNIQUE' : 'INDEX'}(${columnList(index.columns)})` +
            // A partial index without its condition reads as a stricter
            // rule than it is, so the document states it.
            (index.where ? ` WHERE ${plainSql(index.where)}` : ''),
        ),
        ...Object.values(table.compositePrimaryKeys ?? {}).map(
          (key) => `PRIMARY KEY(${(key.columns ?? []).join(', ')})`,
        ),
        ...Object.values(table.foreignKeys ?? {}).map(
          (key) =>
            `FK(${key.columnsFrom.join(', ')} -> ${key.tableTo}.${key.columnsTo.join(', ')})`,
        ),
        ...Object.values(table.checkConstraints ?? {}).map(
          (check) => `CHECK ${check.name}`,
        ),
      ]),
    },
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
  const structure = new Set();
  for (const rawLine of match[3].split('\n')) {
    const line = rawLine.trim();
    const structural =
      // Greedy so an expression index keeps its own brackets:
      // UNIQUE(("payload" ->> 'deckId')).
      /^(INDEX|UNIQUE)\((.*)\)(\s+WHERE\s+.*)?$/.exec(line) ??
      /^(PRIMARY KEY)\((.*)\)\s*$/.exec(line);
    if (structural) {
      structure.add(
        `${structural[1]}(${structural[2]
          .split(',')
          .map((part) => part.trim())
          .join(', ')})${(structural[3] ?? '').replace(/\s+/g, ' ').trimEnd()}`,
      );
      continue;
    }
    const check = /^CHECK\s+([a-z0-9_]+)\s*:/.exec(line);
    if (check) {
      structure.add(`CHECK ${check[1]}`);
      continue;
    }
    if (/^(CHECK|FOREIGN)\b/.test(line)) {
      structure.add(`UNPARSEABLE: ${line}`);
      continue;
    }
    const [name, typeWord] = line.split(/\s+/);
    if (!name) continue;
    const rest = line.slice(line.indexOf(name) + name.length);
    // "FK -> user.id ON DELETE CASCADE" sits on the column line.
    const foreignKey = /FK\s*->\s*([a-z_]+)\.([a-z_]+)/.exec(rest);
    if (foreignKey) {
      structure.add(`FK(${name} -> ${foreignKey[1]}.${foreignKey[2]})`);
    }
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
  documented.set(match[1], { columns, structure });
}

const problems = [];
for (const [table, { columns, structure }] of actual) {
  const documentedTable = documented.get(table);
  if (!documentedTable) {
    problems.push(`table ${table} is not documented`);
    continue;
  }
  const docColumns = documentedTable.columns;
  for (const item of structure) {
    if (!documentedTable.structure.has(item)) {
      problems.push(`${table} has ${item} but the document does not`);
    }
  }
  for (const item of documentedTable.structure) {
    if (item.startsWith('UNPARSEABLE: ')) {
      problems.push(
        `${table}: "${item.slice('UNPARSEABLE: '.length)}" is not in a form ` +
          `this check understands (name your checks: CHECK <name>: <expression>)`,
      );
    } else if (!structure.has(item)) {
      problems.push(
        `${table} documents ${item} but the schema does not have it`,
      );
    }
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
