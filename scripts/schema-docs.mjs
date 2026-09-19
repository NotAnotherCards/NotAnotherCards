// Shared, deterministic rendering for the checked blocks in db-schemas.md.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function readSnapshot(metaDir) {
  const journal = JSON.parse(
    readFileSync(join(metaDir, '_journal.json'), 'utf8'),
  );
  const latest = String(journal.entries.at(-1).idx).padStart(4, '0');
  const path = join(metaDir, `${latest}_snapshot.json`);
  return { latest, path, snapshot: JSON.parse(readFileSync(path, 'utf8')) };
}

export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}
const json = (value) => JSON.stringify(canonical(value));
const sorted = (record) =>
  Object.entries(record ?? {}).sort(([a], [b]) => a.localeCompare(b));
const quote = (name) => `"${name.replaceAll('"', '""')}"`;

// Preserve less common/new attributes rather than silently dropping them.
const extra = (object, known) => {
  const rest = Object.fromEntries(
    Object.entries(object).filter(([key]) => !known.includes(key)),
  );
  return Object.keys(rest).length ? ` OPTIONS ${json(rest)}` : '';
};
const expression = (value) => (typeof value === 'string' ? value : json(value));

export function renderTable(table) {
  const lines = [];
  lines.push(
    `TABLE ${quote(table.schema || 'public')}.${quote(table.name)} RLS ${table.isRLSEnabled ? 'ENABLED' : 'DISABLED'}`,
  );
  for (const [key, col] of sorted(table.columns)) {
    if (key !== col.name) throw new Error(`Column key/name mismatch: ${key}`);
    lines.push(
      `${quote(col.name)} ${col.type}${col.typeSchema ? ` TYPE SCHEMA ${quote(col.typeSchema)}` : ''} ${col.notNull ? 'NOT NULL' : 'NULL'}${col.primaryKey ? ' PRIMARY KEY' : ''}${Object.hasOwn(col, 'default') ? ` DEFAULT ${expression(col.default)}` : ''}${extra(col, ['name', 'type', 'typeSchema', 'notNull', 'primaryKey', 'default'])}`,
    );
  }
  for (const [key, index] of sorted(table.indexes)) {
    const columns = index.columns
      .map(
        (col) =>
          `${col.isExpression ? col.expression : quote(col.expression)} ${col.asc ? 'ASC' : 'DESC'} NULLS ${col.nulls.toUpperCase()}${extra(col, ['expression', 'isExpression', 'asc', 'nulls'])}`,
      )
      .join(', ');
    lines.push(
      `${index.isUnique ? 'UNIQUE ' : ''}INDEX ${quote(key)}${index.concurrently ? ' CONCURRENTLY' : ''} USING ${index.method} (${columns})${index.where ? ` WHERE ${index.where}` : ''}${Object.keys(index.with ?? {}).length ? ` WITH ${json(index.with)}` : ''}${extra(index, ['name', 'columns', 'isUnique', 'concurrently', 'method', 'where', 'with'])}`,
    );
    if (key !== index.name) throw new Error(`Index key/name mismatch: ${key}`);
  }
  for (const [key, constraint] of sorted(table.compositePrimaryKeys)) {
    lines.push(
      `PRIMARY KEY ${quote(key)} (${constraint.columns.map(quote).join(', ')})${extra(constraint, ['name', 'columns'])}`,
    );
    if (key !== constraint.name)
      throw new Error(`Primary key/name mismatch: ${key}`);
  }
  for (const [key, constraint] of sorted(table.uniqueConstraints)) {
    lines.push(
      `UNIQUE ${quote(key)} (${constraint.columns.map(quote).join(', ')}) NULLS ${constraint.nullsNotDistinct ? 'NOT DISTINCT' : 'DISTINCT'}${extra(constraint, ['name', 'columns', 'nullsNotDistinct'])}`,
    );
    if (key !== constraint.name)
      throw new Error(`Unique key/name mismatch: ${key}`);
  }
  for (const [key, fk] of sorted(table.foreignKeys)) {
    lines.push(
      `FOREIGN KEY ${quote(key)} (${fk.columnsFrom.map(quote).join(', ')}) REFERENCES ${quote(fk.schemaTo || 'public')}.${quote(fk.tableTo)} (${fk.columnsTo.map(quote).join(', ')}) ON DELETE ${fk.onDelete.toUpperCase()} ON UPDATE ${fk.onUpdate.toUpperCase()}${extra(fk, ['name', 'tableFrom', 'tableTo', 'schemaTo', 'columnsFrom', 'columnsTo', 'onDelete', 'onUpdate'])}`,
    );
    if (key !== fk.name || fk.tableFrom !== table.name)
      throw new Error(`Foreign key/name mismatch: ${key}`);
  }
  for (const [key, check] of sorted(table.checkConstraints)) {
    lines.push(
      `CHECK ${quote(key)}: ${check.value}${extra(check, ['name', 'value'])}`,
    );
    if (key !== check.name) throw new Error(`Check key/name mismatch: ${key}`);
  }
  for (const [key, policy] of sorted(table.policies))
    lines.push(`POLICY ${quote(key)} ${json(policy)}`);
  const more = extra(table, [
    'name',
    'schema',
    'columns',
    'indexes',
    'foreignKeys',
    'compositePrimaryKeys',
    'uniqueConstraints',
    'checkConstraints',
    'policies',
    'isRLSEnabled',
  ]);
  if (more) lines.push(more.trim());
  return lines.join('\n');
}

export function renderLocal(schema) {
  const lines = [`LOCAL SCHEMA VERSION ${schema.version}`];
  for (const [key, table] of sorted(schema.tables)) {
    lines.push('', `TABLE ${key} ${table.localOnly ? 'LOCAL ONLY' : 'SYNCED'}`);
    for (const [name, column] of sorted(table.columns)) {
      lines.push(
        `${name} ${column.type} ${column.isOptional ? 'NULL' : 'NOT NULL'}${column.isIndexed ? ' INDEXED' : ''}${extra(column, ['name', 'type', 'isOptional', 'isIndexed'])}`,
      );
      if (name !== column.name)
        throw new Error(`Local column key/name mismatch: ${name}`);
    }
    const more = extra(table, ['name', 'columns', 'columnArray', 'localOnly']);
    if (more) lines.push(more.trim());
    if (key !== table.name)
      throw new Error(`Local table key/name mismatch: ${key}`);
  }
  const more = extra(schema, ['version', 'tables']);
  if (more) lines.push(more.trim());
  return lines.join('\n');
}

export function expectedBlocks(snapshot, localSchema) {
  const blocks = new Map();
  for (const [key, table] of sorted(snapshot.tables)) {
    if (key !== `${table.schema || 'public'}.${table.name}`)
      throw new Error(`Table key/name mismatch: ${key}`);
    blocks.set(`table:${key}`, renderTable(table));
  }
  // Sequences, enums, views, policies, and future snapshot attributes also
  // participate; empty kinds are left out of the block. Snapshot IDs and
  // rename bookkeeping are not schema objects.
  const other = Object.fromEntries(
    Object.entries(snapshot).filter(
      ([key, value]) =>
        !['id', 'prevId', '_meta', 'version', 'dialect', 'tables'].includes(
          key,
        ) &&
        (typeof value !== 'object' || Object.keys(value).length),
    ),
  );
  blocks.set('server-objects', JSON.stringify(canonical(other), null, 2));
  blocks.set('local-schema', renderLocal(localSchema));
  return blocks;
}

const blockPattern =
  /<!-- schema:([^\s]+) -->\n\n?```(?:text|json)\n([\s\S]*?)\n```\n\n?<!-- \/schema -->/g;
export function checkDocument(doc, expected) {
  const problems = [];
  const found = new Set();
  for (const match of doc.matchAll(blockPattern)) {
    const [, id, body] = match;
    if (found.has(id)) problems.push(`duplicate block ${id}`);
    found.add(id);
    if (!expected.has(id)) problems.push(`obsolete block ${id}`);
    else if (body !== expected.get(id)) problems.push(`outdated block ${id}`);
  }
  for (const id of expected.keys())
    if (!found.has(id)) problems.push(`missing block ${id}`);
  return problems;
}

export function updateDocument(doc, expected) {
  // New tables need an explanatory section and explicit marker before write
  // mode can fill the block; it must not silently remove deleted-table prose.
  const ids = [...doc.matchAll(blockPattern)].map((match) => match[1]);
  if (
    new Set(ids).size !== ids.length ||
    ids.length !== expected.size ||
    ids.some((id) => !expected.has(id))
  ) {
    throw new Error(
      'Add/remove the relevant schema sections and their markers before regenerating the blocks.',
    );
  }
  return doc.replace(blockPattern, (match, id) =>
    match.replace(
      /(```(?:text|json)\n)[\s\S]*?(\n```)/,
      (_, open, close) => open + expected.get(id) + close,
    ),
  );
}

export function schemaDifferences(snapshot, source) {
  const problems = [];
  const walk = (a, b, path) => {
    if (json(a) === json(b)) return;
    if (
      a &&
      b &&
      !Array.isArray(a) &&
      !Array.isArray(b) &&
      typeof a === 'object' &&
      typeof b === 'object'
    ) {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)]))
        walk(a[key], b[key], path ? `${path}.${key}` : key);
    } else
      problems.push(
        `${path}: snapshot=${json(a) ?? '<missing>'}, source=${json(b) ?? '<missing>'}`,
      );
  };
  const definition = (value) =>
    Object.fromEntries(
      Object.entries(value).filter(
        ([key]) => !['id', 'prevId', '_meta'].includes(key),
      ),
    );
  walk(definition(snapshot), definition(source), '');
  return problems;
}
