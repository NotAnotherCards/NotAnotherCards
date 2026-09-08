import { execFileSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function executable(paths) {
  for (const path of paths) {
    if (!path) continue;
    try {
      accessSync(path, constants.X_OK);
      return path;
    } catch {
      // Try the next supported location.
    }
  }
  return undefined;
}

function executableOnPath(names) {
  const directories = (process.env.PATH ?? '').split(delimiter);
  return executable(
    directories.flatMap((directory) =>
      names.map((name) => join(directory, name)),
    ),
  );
}

function findChrome() {
  return executable([
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    process.env.PROGRAMFILES
      ? join(
          process.env.PROGRAMFILES,
          'Google',
          'Chrome',
          'Application',
          'chrome.exe',
        )
      : undefined,
    process.env.LOCALAPPDATA
      ? join(
          process.env.LOCALAPPDATA,
          'Google',
          'Chrome',
          'Application',
          'chrome.exe',
        )
      : undefined,
    executableOnPath([
      'google-chrome',
      'google-chrome-stable',
      'chromium',
      'chromium-browser',
    ]),
  ]);
}

function findHermes() {
  const engineRoot = dirname(require.resolve('hermes-engine-cli/package.json'));
  const platformDirectory = {
    darwin: 'osx-bin',
    linux: 'linux64-bin',
    win32: 'win64-bin',
  }[process.platform];
  if (!platformDirectory) return undefined;
  const binary = process.platform === 'win32' ? 'hermes.exe' : 'hermes';
  return executable([join(engineRoot, platformDirectory, binary)]);
}

function lastOutputLine(output) {
  return output.trim().split(/\r?\n/).at(-1);
}

const chrome = findChrome();
if (!chrome) {
  throw new Error('Chrome or Chromium is required for the activity contract');
}

const hermes = findHermes();
if (!hermes) {
  throw new Error('The Hermes runtime is required for the activity contract');
}

const directory = await mkdtemp(join(tmpdir(), 'nac-activity-contract-'));
try {
  const bundle = join(directory, 'activity-contract.js');
  await build({
    entryPoints: [
      join(packageRoot, 'contract', 'activity-runtime-contract.ts'),
    ],
    outfile: bundle,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2019',
    // The contract runs without Intl even when a host provides a complete
    // implementation, matching standalone Hermes and proving the selector's
    // calendar conversion comes only from bundled timezone data.
    banner: { js: 'globalThis.Intl = undefined;' },
  });

  const nodeOutput = lastOutputLine(
    execFileSync(process.execPath, [bundle], { encoding: 'utf8' }),
  );
  const hermesOutput = lastOutputLine(
    execFileSync(hermes, ['-w', bundle], { encoding: 'utf8' }),
  );

  const html = join(directory, 'contract.html');
  await writeFile(
    html,
    '<!doctype html><html><body><script src="activity-contract.js"></script></body></html>',
  );
  const browserDom = execFileSync(
    chrome,
    [
      '--headless',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--dump-dom',
      pathToFileURL(html).href,
    ],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 20_000,
    },
  );
  const browserOutput = /<body>(.*)<\/body>/s.exec(browserDom)?.[1];

  if (!nodeOutput || !hermesOutput || !browserOutput) {
    throw new Error('A runtime did not return an activity contract result');
  }
  if (nodeOutput !== hermesOutput || nodeOutput !== browserOutput) {
    throw new Error(
      `Activity results differ by runtime:\nNode: ${nodeOutput}\nHermes: ${hermesOutput}\nBrowser: ${browserOutput}`,
    );
  }

  // Parse once as a final guard against comparing identical error text.
  JSON.parse(nodeOutput);
  console.log('Activity runtime contract passed in Node, Hermes, and Chrome');
} finally {
  await rm(directory, { recursive: true, force: true });
}
