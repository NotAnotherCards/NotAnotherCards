import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const logDir = new URL('../apps/web/playwright-logs/', import.meta.url);
await mkdir(logDir, { recursive: true });

// Shell variables take precedence over --env-file. Pin every interpolation
// variable as well so a developer's exported credentials cannot reach the stack.
const testEnv = Object.fromEntries(
  (await readFile(new URL('../infra/browser.env', import.meta.url), 'utf8'))
    .split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => [
      line.slice(0, line.indexOf('=')),
      line.slice(line.indexOf('=') + 1),
    ]),
);
const env = { ...process.env, ...testEnv };
const compose = [
  'compose',
  '--project-name',
  `nac-browser-${process.pid}`,
  '--env-file',
  'infra/browser.env',
  '-f',
  'docker-compose.yml',
  '-f',
  'docker-compose.browser.yml',
];

let activeChild;
let interrupted = false;
let cleaningUp = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    interrupted = true;
    if (!cleaningUp) activeChild?.kill('SIGTERM');
  });
}

function run(command, args, logName, echo = true) {
  return new Promise((resolve, reject) => {
    const log = logName && createWriteStream(new URL(logName, logDir));
    const child = spawn(command, args, {
      cwd: root,
      env,
      // Terminal signals target the whole foreground process group. Isolate
      // cleanup too, so Ctrl+C cannot bypass the parent's signal handler.
      detached: cleaningUp,
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    activeChild = child;
    child.stdout.on('data', (data) => {
      log?.write(data);
      if (echo) process.stdout.write(data);
    });
    child.stderr.on('data', (data) => {
      log?.write(data);
      if (echo) process.stderr.write(data);
    });
    child.on('error', (error) => {
      log?.end();
      reject(error);
    });
    child.on('close', (code) => {
      activeChild = undefined;
      if (log) log.end(() => resolve(code ?? 1));
      else resolve(code ?? 1);
    });
  });
}

let exitCode = 1;
try {
  const started = await run(
    'docker',
    [...compose, 'up', '--build', '--wait', '--wait-timeout', '120', 'web'],
    'build.log',
  );
  if (started === 0 && !interrupted) {
    exitCode = await run('pnpm', [
      '--filter',
      'web',
      'test:e2e',
      ...process.argv.slice(2),
    ]);
  }
} finally {
  // Keep handlers installed, but let logs and removal finish even if another
  // interrupt arrives. The interrupted exit status is set after teardown.
  cleaningUp = true;
  try {
    await run(
      'docker',
      [...compose, 'logs', '--no-color', '--timestamps'],
      'compose.log',
      false,
    );
  } finally {
    const stopped = await run(
      'docker',
      [...compose, 'down', '--volumes', '--remove-orphans', '--rmi', 'local'],
      'cleanup.log',
    );
    if (stopped !== 0) exitCode = stopped;
  }
}
process.exitCode = interrupted ? 130 : exitCode;
