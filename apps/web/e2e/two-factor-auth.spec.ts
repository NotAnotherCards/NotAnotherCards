import { expect, test, type Page } from '@playwright/test';
import { base32 } from '@better-auth/utils/base32';
import { createOTP } from '@better-auth/utils/otp';

const appOrigin = 'http://localhost:5173';
const password = 'TestPassword123!';
const englishId = '00000000-0000-0000-0000-000000000001';
const spanishId = '00000000-0000-0000-0000-000000000002';

function uniqueIdentity() {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  return {
    email: `web-2fa-${suffix}@example.com`,
    username: `web2fa_${suffix.replace('-', '_')}`,
  };
}

function decodeTotpSecret(encodedSecret: string): string {
  return new TextDecoder().decode(base32.decode(encodedSecret));
}

async function fillTotp(page: Page, code: string) {
  for (const [index, digit] of [...code].entries()) {
    await page.getByLabel(`Digit ${index + 1} of 6`).fill(digit);
  }
}

async function signUpAndOnboard(page: Page, email: string, username: string) {
  await signUp(page, email);

  const onboarding = await page.request.post('/api/auth/onboard', {
    headers: { Origin: appOrigin },
    data: {
      username,
      native_language_id: englishId,
      target_language_id: spanishId,
    },
  });
  expect(onboarding.ok()).toBe(true);

  const signedOut = await page.request.post('/api/auth/sign-out', {
    headers: { Origin: appOrigin },
  });
  expect(signedOut.ok()).toBe(true);

  await signIn(page, email);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole('button', { name: 'Profile & Settings' }),
  ).toBeVisible();
}

async function signUp(page: Page, email: string) {
  const response = await page.request.post('/api/auth/sign-up/email', {
    headers: { Origin: appOrigin },
    data: { email, password, name: 'Web 2FA Tester' },
  });
  expect(response.ok()).toBe(true);
}

async function openSecuritySettings(page: Page) {
  await page.getByRole('button', { name: 'Profile & Settings' }).click();
  await page.getByRole('button', { name: 'Security', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Two-factor authentication' }),
  ).toBeVisible();
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login/);
}

async function signIn(page: Page, email: string, redirect = '/dashboard') {
  await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
}

async function firstVisibleBackupCode(page: Page, title: string) {
  const heading = page.getByRole('heading', { name: title });
  await expect(heading).toBeVisible();
  const code = await heading
    .locator('xpath=../following-sibling::ul[1]/li[1]')
    .textContent();
  if (!code?.trim()) throw new Error('No backup code was rendered');
  return code.trim();
}

test('completes the web 2FA lifecycle with real sessions and route guards', async ({
  page,
}) => {
  test.slow();
  const { email, username } = uniqueIdentity();
  await signUpAndOnboard(page, email, username);
  await openSecuritySettings(page);

  await page
    .getByRole('button', { name: 'Enable two-factor authentication' })
    .click();
  await page.locator('#two-factor-password').fill(password);
  await page.getByRole('button', { name: 'Continue' }).click();

  // Abandoning an unverified setup must clear its material, including when
  // browser history returns to the dashboard, and enrollment must be usable
  // again instead of leaving the account in a half-configured state.
  await expect(page.locator('#manual-secret')).toBeVisible();
  await page.goto('/dashboard?left=setup');
  await page.goBack();
  await expect(page).toHaveURL(/\/dashboard$/);
  await openSecuritySettings(page);
  await expect(page.locator('#manual-secret')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Save your backup codes' }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Enable two-factor authentication' })
    .click();
  await page.locator('#two-factor-password').fill(password);
  await page.getByRole('button', { name: 'Continue' }).click();

  const encodedSecret = await page.locator('#manual-secret').inputValue();
  const rawSecret = decodeTotpSecret(encodedSecret);
  await fillTotp(page, await createOTP(rawSecret).totp());
  const refreshedSession = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === '/api/auth/get-session' &&
      response.request().method() === 'GET'
    );
  });
  await page.getByRole('button', { name: 'Verify and enable' }).click();
  await refreshedSession;

  // This assertion crosses the session refetch that used to unmount the only
  // copy of the one-time codes before the user could save them.
  await firstVisibleBackupCode(page, 'Save your backup codes');
  await expect(page.getByText('Two-factor is enabled')).toBeVisible();
  await page.getByRole('button', { name: 'I saved my codes' }).click();

  await signOut(page);
  await signIn(page, email, '/dashboard?e2e=return');
  await expect(
    page.getByRole('heading', { name: 'Two-factor verification' }),
  ).toBeVisible();

  // Reloading and trying a protected URL must preserve the pending challenge,
  // never mint a protected session, and retain a safe return destination.
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Two-factor verification' }),
  ).toBeVisible();
  await page.goto('/dashboard?e2e=return');
  await expect(page).toHaveURL(/\/two-factor\?redirect=/);
  expect(new URL(page.url()).searchParams.get('redirect')).toBe(
    '/dashboard?e2e=return',
  );

  // The plugin allows three /two-factor/* requests per ten seconds. The setup,
  // restart, and verification used that window, so start the challenge fresh.
  await page.waitForTimeout(11_000);
  const staleCounter = Math.floor(Date.now() / 30_000) - 5;
  await fillTotp(page, await createOTP(rawSecret).hotp(staleCounter));
  await page.getByRole('button', { name: 'Verify and continue' }).click();
  await expect(
    page.getByText('That authentication code is invalid or has expired.'),
  ).toBeVisible();

  await fillTotp(page, await createOTP(rawSecret).totp());
  await page.getByRole('button', { name: 'Verify and continue' }).click();
  await expect(page).toHaveURL(/\/dashboard\?e2e=return$/);

  await openSecuritySettings(page);
  await page.getByRole('button', { name: 'Regenerate backup codes' }).click();
  await page.locator('#two-factor-regenerate-password').fill(password);
  await page.getByRole('button', { name: 'Generate new codes' }).click();
  const replacementBackupCode = await firstVisibleBackupCode(
    page,
    'Your new backup codes',
  );
  await page.getByRole('button', { name: 'I saved my codes' }).click();

  // Regeneration was the third request in this window. Begin recovery sign-in
  // after it expires so this test validates application behavior, not throttling.
  await page.waitForTimeout(11_000);
  await signOut(page);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/two-factor/);
  await page.getByRole('button', { name: 'Backup code' }).click();
  await page.getByLabel('Backup code').fill(replacementBackupCode);
  await page.getByRole('button', { name: 'Verify and continue' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await openSecuritySettings(page);
  await page.getByRole('button', { name: 'Disable two-factor' }).click();
  await page.locator('#two-factor-disable-password').fill(password);
  await page
    .getByRole('button', { name: 'Disable two-factor', exact: true })
    .click();
  await expect(page.getByText('Two-factor is off')).toBeVisible();

  await signOut(page);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole('heading', { name: 'Two-factor verification' }),
  ).toHaveCount(0);
});

test('shows the server lockout response after repeated failed challenges', async ({
  page,
}) => {
  test.slow();
  // The preceding lifecycle ends with two /two-factor/* requests. Let the
  // shared per-IP limiter expire before creating another enrollment.
  await page.waitForTimeout(11_000);

  const { email } = uniqueIdentity();
  await signUp(page, email);
  const enrollment = await page.request.post('/api/auth/two-factor/enable', {
    headers: { Origin: appOrigin },
    data: { password },
  });
  expect(enrollment.ok()).toBe(true);
  const enrollmentBody = (await enrollment.json()) as { totpURI: string };
  const encodedSecret = new URL(enrollmentBody.totpURI).searchParams.get(
    'secret',
  );
  if (!encodedSecret) throw new Error('Enrollment did not return a TOTP key');
  const rawSecret = decodeTotpSecret(encodedSecret);

  const verified = await page.request.post('/api/auth/two-factor/verify-totp', {
    headers: { Origin: appOrigin },
    data: { code: await createOTP(rawSecret).totp() },
  });
  expect(verified.ok()).toBe(true);
  const signedOut = await page.request.post('/api/auth/sign-out', {
    headers: { Origin: appOrigin },
  });
  expect(signedOut.ok()).toBe(true);

  await signIn(page, email);
  await expect(page).toHaveURL(/\/two-factor/);
  await page.waitForTimeout(11_000);
  const invalidCode = await createOTP(rawSecret).hotp(
    Math.floor(Date.now() / 30_000) - 5,
  );

  const submitInvalidCode = async () => {
    await fillTotp(page, invalidCode);
    const response = page.waitForResponse((candidate) => {
      const url = new URL(candidate.url());
      return (
        url.pathname === '/api/auth/two-factor/verify-totp' &&
        candidate.request().method() === 'POST'
      );
    });
    await page.getByRole('button', { name: 'Verify and continue' }).click();
    await response;
    await expect(
      page.getByText('That authentication code is invalid or has expired.'),
    ).toBeVisible();
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await submitInvalidCode();
  }
  await page.waitForTimeout(11_000);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await submitInvalidCode();
  }

  await fillTotp(page, await createOTP(rawSecret).totp());
  await page.getByRole('button', { name: 'Verify and continue' }).click();
  await expect(
    page.getByText(
      'Too many failed attempts. Your account is temporarily locked. Please try again later.',
    ),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/two-factor/);
});
