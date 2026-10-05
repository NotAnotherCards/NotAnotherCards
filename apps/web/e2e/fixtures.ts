import {
  test as base,
  expect,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { randomBytes } from 'node:crypto';

function clientHeaders(
  baseURL: string | undefined,
  headers: Record<string, string> = {},
) {
  // Give each test client a distinct forwarded address. Separate test clients must not
  // share Better Auth's fallback rate-limit bucket. Leave live requests intact.
  if (baseURL !== 'http://localhost:4173') return headers;
  const subnet = randomBytes(4).toString('hex');
  return {
    ...headers,
    'x-forwarded-for': `2001:db8:${subnet.slice(0, 4)}:${subnet.slice(4)}::1`,
  };
}

type ExpectedHttpError = { url: string; status: number; remaining: number };

function collectBrowserErrors(
  context: BrowserContext,
  errors: string[],
  expectedHttpErrors: ExpectedHttpError[],
) {
  // Context events cover every page, including popups, before navigation.
  context.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') {
      // Negative auth scenarios assert the HTTP response separately. Exempt
      // only that one browser-generated resource error; console.error calls
      // have arguments and always remain part of the JavaScript console gate.
      const expected = expectedHttpErrors.find(
        (error) =>
          error.remaining > 0 &&
          error.url === message.location().url &&
          message.type() === 'error' &&
          message.args().length === 0 &&
          message
            .text()
            .startsWith(
              `Failed to load resource: the server responded with a status of ${error.status} `,
            ),
      );
      if (expected) {
        expected.remaining -= 1;
        return;
      }
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
  fitsViewport: void;
  expectedHttpErrors: ExpectedHttpError[];
  expectHttpError: (
    page: Page,
    path: string,
    status: number,
    action: () => Promise<unknown>,
  ) => Promise<void>;
}>({
  extraHTTPHeaders: async ({ baseURL, extraHTTPHeaders }, use) => {
    await use(clientHeaders(baseURL, extraHTTPHeaders));
  },
  // Playwright reads fixture dependencies from this destructuring pattern.
  // eslint-disable-next-line no-empty-pattern
  browserErrors: async ({}, use) => {
    await use([]);
  },
  // eslint-disable-next-line no-empty-pattern
  expectedHttpErrors: async ({}, use) => {
    await use([]);
  },
  expectHttpError: async ({ expectedHttpErrors }, use) => {
    await use(async (page, path, status, action) => {
      const url = new URL(path, page.url()).href;
      expectedHttpErrors.push({ url, status, remaining: 1 });
      const response = page.waitForResponse(
        (candidate) =>
          candidate.url() === url && candidate.request().method() === 'POST',
      );
      await action();
      expect((await response).status()).toBe(status);
    });
  },
  context: async ({ context, browserErrors, expectedHttpErrors }, use) => {
    collectBrowserErrors(context, browserErrors, expectedHttpErrors);
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
      expectedHttpErrors,
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
      collectBrowserErrors(context, browserErrors, expectedHttpErrors);
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
  fitsViewport: [
    async ({ page }, use) => {
      await use();
      if (!page.isClosed()) await expectNoHorizontalOverflow(page);
    },
    { auto: true },
  ],
});

export { expect };

/** Fails when the page scrolls sideways, the usual sign of a broken phone layout. */
export async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      { message: `Page is wider than the viewport at ${page.url()}` },
    )
    .toBeLessThanOrEqual(1);
}

/** Normal vertical scrolling is allowed; controls must remain fully reachable. */
export async function expectFitsViewport(control: Locator) {
  await expect(control).toBeVisible();
  await control.scrollIntoViewIfNeeded();
  await expect
    .poll(
      async () =>
        control.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const clipped: string[] = [];
          const tolerance = 1;
          if (
            rect.left < -tolerance ||
            rect.right > document.documentElement.clientWidth + tolerance
          )
            clipped.push('viewport horizontally');
          if (
            rect.top < -tolerance ||
            rect.bottom > window.innerHeight + tolerance
          )
            clipped.push('viewport vertically');
          for (
            let parent = element.parentElement;
            parent;
            parent = parent.parentElement
          ) {
            const style = getComputedStyle(parent);
            const bounds = parent.getBoundingClientRect();
            const left = bounds.left + parent.clientLeft;
            const top = bounds.top + parent.clientTop;
            if (
              style.overflowX !== 'visible' &&
              (rect.left < left - tolerance ||
                rect.right > left + parent.clientWidth + tolerance)
            )
              clipped.push(`${parent.tagName} horizontally`);
            if (
              style.overflowY !== 'visible' &&
              (rect.top < top - tolerance ||
                rect.bottom > top + parent.clientHeight + tolerance)
            )
              clipped.push(`${parent.tagName} vertically`);
          }
          return clipped;
        }),
      { message: `Control is clipped: ${control}` },
    )
    .toEqual([]);
}

export async function expectDashboardReady(page: Page) {
  await expect(page).toHaveURL('/dashboard');
  await expect(
    page.getByRole('heading', { name: 'Dashboard', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('tab', { name: 'My Library', exact: true }),
  ).toBeEnabled();
  await expect(page.getByTestId('sync-status')).toHaveText('Synced');
  await expectNoHorizontalOverflow(page);
  await expectFitsViewport(
    page.getByRole('tab', { name: 'My Library', exact: true }),
  );
}
