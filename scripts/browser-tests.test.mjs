import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';

async function probe(t, blocked = ['down']) {
  const root = await mkdtemp(join(tmpdir(), 'browser-cleanup-'));
  for (const dir of ['scripts', 'infra', 'bin']) await mkdir(join(root, dir));
  await copyFile(
    new URL('./browser-tests.mjs', import.meta.url),
    join(root, 'scripts/browser-tests.mjs'),
  );
  await writeFile(join(root, 'infra/browser.env'), 'POSTGRES_USER=probe\n');
  const stub = `#!${process.execPath}
const { appendFileSync, existsSync, rmSync, writeFileSync } = require('node:fs');
const { basename, join } = require('node:path');
const root = process.env.PROBE_ROOT;
const phase = basename(process.argv[1]) === 'pnpm'
  ? 'tests' : process.argv.find((arg) => ['up', 'logs', 'down'].includes(arg));
const event = (name) => appendFileSync(join(root, 'events'), phase + ':' + name + '\\n');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  event(signal);
  process.exit(143);
});
if (phase === 'up') writeFileSync(join(root, 'resources'), 'containers,images,volume');
event('started');
const finish = () => {
  if (phase === 'down') rmSync(join(root, 'resources'));
  event('finished');
  process.exit(0);
};
if (process.env.PROBE_BLOCKED.split(',').includes(phase)) {
  setInterval(() => {
    if (existsSync(join(root, phase + '.release'))) finish();
  }, 10);
} else finish();
`;
  for (const command of ['docker', 'pnpm'])
    await writeFile(join(root, 'bin', command), stub, { mode: 0o755 });
  const child = spawn(
    process.execPath,
    [join(root, 'scripts/browser-tests.mjs')],
    {
      detached: true,
      env: {
        ...process.env,
        PATH: `${join(root, 'bin')}:${process.env.PATH}`,
        PROBE_ROOT: root,
        PROBE_BLOCKED: blocked.join(','),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let output = '';
  child.stdout.on('data', (data) => (output += data));
  child.stderr.on('data', (data) => (output += data));
  const exited = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal }));
  });
  const release = (phase) => writeFile(join(root, `${phase}.release`), '');
  t.after(async () => {
    await Promise.all(['up', 'tests', 'logs', 'down'].map(release));
    if (
      (await Promise.race([exited, delay(2000, undefined, { ref: false })])) ===
      undefined
    ) {
      child.kill('SIGKILL');
      await exited;
    }
    await rm(root, { recursive: true, force: true });
  });
  const events = () =>
    existsSync(join(root, 'events'))
      ? readFileSync(join(root, 'events'), 'utf8').trim().split('\n')
      : [];
  return {
    child,
    events,
    release,
    async waitFor(event) {
      const deadline = Date.now() + 5000;
      while (!events().includes(event)) {
        assert.equal(child.exitCode, null, `Runner exited early: ${output}`);
        assert.ok(Date.now() < deadline, `Missing ${event}: ${events()}`);
        await delay(10);
      }
    },
    async interrupt(signal, group = false) {
      if (group) process.kill(-child.pid, signal);
      else child.kill(signal);
      await delay(50);
    },
    async assertCleaned() {
      assert.deepEqual(await exited, { code: 130, signal: null }, output);
      assert.equal(existsSync(join(root, 'resources')), false);
      assert.equal(
        events().filter((event) => event === 'down:finished').length,
        1,
      );
      assert.ok(!events().some((event) => /^(logs|down):SIG/.test(event)));
    },
  };
}

const options = { skip: process.platform === 'win32', timeout: 10_000 };
for (const signal of ['SIGINT', 'SIGTERM']) {
  test(
    `awaits cleanup when ${signal} arrives during compose down`,
    options,
    async (t) => {
      const run = await probe(t);
      await run.waitFor('down:started');
      await run.interrupt(signal);
      await run.release('down');
      await run.assertCleaned();
    },
  );
}

test(
  'repeated interrupts after cancelling tests cannot abort logs or removal',
  options,
  async (t) => {
    const run = await probe(t, ['tests', 'logs', 'down']);
    await run.waitFor('tests:started');
    await run.interrupt('SIGINT');
    await run.waitFor('logs:started');
    assert.ok(run.events().includes('tests:SIGTERM'));
    await run.interrupt('SIGTERM');
    await run.release('logs');
    await run.waitFor('down:started');
    await run.interrupt('SIGINT');
    await run.release('down');
    await run.assertCleaned();
  },
);

test(
  'terminal process-group interrupts cannot reach compose down',
  options,
  async (t) => {
    const run = await probe(t);
    await run.waitFor('down:started');
    await run.interrupt('SIGINT', true);
    await run.release('down');
    await run.assertCleaned();
  },
);
