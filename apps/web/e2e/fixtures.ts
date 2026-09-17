import {
  test as base,
  expect,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { randomBytes } from 'node:crypto';

function clientHeaders(
  baseURL: string | undefined,
  headers: Record<string, string> = {},
) {
  // Local preview has no forwarding headers. Separate test clients must not
  // share Better Auth's fallback rate-limit bucket. Leave live requests intact.
  if (baseURL !== 'http://localhost:4173') return headers;
  const subnet = randomBytes(4).toString('hex');
  return {
    ...headers,
    'x-forwarded-for': `2001:db8:${subnet.slice(0, 4)}:${subnet.slice(4)}::1`,
  };
}

function collectBrowserErrors(context: BrowserContext, errors: string[]) {
  // Context events cover every page, including popups, before navigation.
  context.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') {
      errors.push(
        `${message.type()}: ${message.text()} (${message.location().url})`,
      );
    }
  });
  context.on('weberror', (error) =>
    errors.push(error.error().stack ?? error.error().message),
  );
}

export const test = base.extend<{
  browserErrors: string[];
  newContext: () => Promise<BrowserContext>;
  cleanConsole: void;
}>({
  extraHTTPHeaders: async ({ baseURL, extraHTTPHeaders }, use) => {
    await use(clientHeaders(baseURL, extraHTTPHeaders));
  },
  // Playwright reads fixture dependencies from this destructuring pattern.
  // eslint-disable-next-line no-empty-pattern
  browserErrors: async ({}, use) => {
    await use([]);
  },
  context: async ({ context, browserErrors }, use) => {
    collectBrowserErrors(context, browserErrors);
    await use(context);
  },
  // Use this fixture for additional accounts/sessions so they share the gate.
  newContext: async (
    {
      browser,
      baseURL,
      locale,
      timezoneId,
      viewport,
      extraHTTPHeaders,
      browserErrors,
    },
    use,
  ) => {
    const contexts: BrowserContext[] = [];
    await use(async () => {
      const context = await browser.newContext({
        baseURL,
        locale,
        timezoneId,
        viewport,
        extraHTTPHeaders: clientHeaders(baseURL, extraHTTPHeaders),
      });
      collectBrowserErrors(context, browserErrors);
      contexts.push(context);
      return context;
    });
    await Promise.all(contexts.map((context) => context.close()));
  },
  cleanConsole: [
    async ({ browserErrors }, use, testInfo) => {
      await use();
      if (browserErrors.length) {
        await testInfo.attach('browser-errors', {
          body: browserErrors.join('\n'),
          contentType: 'text/plain',
        });
      }
      expect(
        browserErrors,
        'Browser warnings, errors, and uncaught exceptions',
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export async function expectDashboardReady(page: Page) {
  await expect(page).toHaveURL('/dashboard');
  await expect(
    page.getByRole('heading', { name: 'Dashboard Page', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'My Library', exact: true }),
  ).toBeEnabled();
  await expect(page.getByTestId('sync-status')).toHaveText('Synced');
}
