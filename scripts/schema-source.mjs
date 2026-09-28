import { globSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

export function loadSource(root) {
  const apiDir = resolve(root, 'apps/api');
  // Resolve the API's own declared drizzle-kit/tsx dependencies. Loading
  // TypeScript source avoids trusting stale build output for schema edits.
  const apiRequire = createRequire(resolve(apiDir, 'package.json'));
  apiRequire('tsx/cjs');
  const config = apiRequire('./drizzle.config.ts').default;
  if (config.dialect !== 'postgresql')
    throw new Error('Expected PostgreSQL schema');
  const files = globSync(config.schema, { cwd: apiDir }).sort();
  if (!files.length)
    throw new Error('No schema files matched drizzle.config.ts');
  const imports = {};
  for (const file of files) {
    for (const [name, value] of Object.entries(
      apiRequire(resolve(apiDir, file)),
    )) {
      if (Object.hasOwn(imports, name) && imports[name] !== value)
        throw new Error(`Duplicate schema export: ${name}`);
      imports[name] = value;
    }
  }
  const { generateDrizzleJson } = apiRequire('drizzle-kit/api');
  const snapshot = generateDrizzleJson(
    imports,
    undefined,
    undefined,
    config.casing,
  );
  const localSchema = apiRequire(
    resolve(root, 'packages/offline-db/src/index.ts'),
  ).schema;
  return { snapshot, localSchema };
}
