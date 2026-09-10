import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { expect, expectDashboardReady } from './fixtures.js';

export async function registerAndOnboard(page: Page) {
  const id = randomUUID().replaceAll('-', '');
  const account = {
    email: `browser-${id}@example.com`,
    username: `e2e_${id.slice(0, 20)}`,
    name: 'Browser Test',
    password: 'Browser-test-252!',
  };
  await page.goto('/register');
  await page.getByLabel('Name', { exact: true }).fill(account.name);
  await page.getByLabel('Email', { exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page
    .getByLabel('Confirm Password', { exact: true })
    .fill(account.password);
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();

  await expect(page).toHaveURL('/onboarding');
  await page.getByLabel('Username', { exact: true }).fill(account.username);
  await page
    .getByLabel('Native Language', { exact: true })
    .selectOption({ label: '🇺🇸 English' });
  await page
    .getByLabel('Target Language', { exact: true })
    .selectOption({ label: '🇪🇸 Spanish' });
  await page
    .getByRole('button', { name: 'Complete registration', exact: true })
    .click();
  await expectDashboardReady(page);
  return account;
}

export async function signIn(
  page: Page,
  account: { email: string; password: string },
) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expectDashboardReady(page);
}
