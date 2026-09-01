// Runs madge --circular for every workspace and reports all of them,
// instead of stopping at the first one with a cycle.
import { spawnSync } from 'node:child_process';

const workspaces = [
  {
    name: 'offline-db',
    tsconfig: 'packages/offline-db/tsconfig.json',
    exts: 'ts',
    dirs: ['packages/offline-db/src'],
  },
  {
    name: 'schemas',
    tsconfig: 'packages/schemas/tsconfig.json',
    exts: 'ts',
    dirs: ['packages/schemas/src'],
  },
  {
    name: 'api',
    tsconfig: 'apps/api/tsconfig.json',
    exts: 'ts',
    dirs: ['apps/api/src'],
  },
  {
    name: 'web',
    tsconfig: 'apps/web/tsconfig.json',
    exts: 'ts,tsx',
    dirs: ['apps/web/src'],
  },
  {
    name: 'mobile',
    tsconfig: 'apps/mobile/tsconfig.json',
    exts: 'ts,tsx',
    dirs: ['apps/mobile/app', 'apps/mobile/lib', 'apps/mobile/components'],
  },
];

let failed = false;
for (const ws of workspaces) {
  const res = spawnSync(
    'pnpm',
    [
      'exec',
      'madge',
      '--circular',
      '--extensions',
      ws.exts,
      '--ts-config',
      ws.tsconfig,
      ...ws.dirs,
    ],
    { stdio: 'inherit' },
  );
  if (res.status !== 0) {
    failed = true;
    console.error(`cycle check failed in ${ws.name}`);
  }
}
process.exit(failed ? 1 : 0);
