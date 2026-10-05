import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint({
  cwd: process.cwd(),
  overrideConfig: [
    {
      languageOptions: {
        parserOptions: { projectService: false, project: null },
      },
      rules: {
        '@typescript-eslint/no-floating-promises': 'off',
        '@typescript-eslint/no-unsafe-type-assertion': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
      },
    },
  ],
});

async function translationErrors(
  source: string,
  filePath = 'src/components/Home.tsx',
) {
  const [result] = await eslint.lintText(source, { filePath });
  expect(result.messages.filter((message) => message.fatal)).toEqual([]);
  return result.messages.filter(
    (message) => message.ruleId === 'i18next/no-literal-string',
  );
}

describe('web localization lint guard', () => {
  it.each([
    '<p>Untranslated text</p>',
    '<button aria-label="Account menu" />',
    '<input placeholder="Search cards" />',
    '<img alt="User avatar" />',
    '<div title="Card catalog" />',
    '<p>{"Untranslated text"}</p>',
    '<p>{`Highest ${count}`}</p>',
    '<button aria-label={hidden ? "Hide password" : "Show password"} />',
    '<p>ERROR</p>',
  ])('rejects user-facing literals: %s', async (source) => {
    expect(await translationErrors(source)).not.toHaveLength(0);
  });

  it('allows translations, brand names, symbols, and structural values', async () => {
    expect(
      await translationErrors(`
      <div className="p-4" role="status" data-testid="status" aria-live="polite">
        <a href="/login">NotAnotherCards</a>
        <img alt="NotAnotherCards" src="/brand/logo.svg" />
        <input id="search" aria-describedby="search-help" placeholder={t('search')} />
        <button aria-label={t('account_menu')}>{t('retry')}</button>
        <p>{t('chart', { count })}</p>
        <span>✓</span>
      </div>
    `),
    ).toEqual([]);
  });

  it('allows literal fixtures in tests and still checks shared UI components', async () => {
    expect(
      await translationErrors(
        '<p>English fixture</p>',
        'src/test/i18n.test.tsx',
      ),
    ).toEqual([]);
    expect(
      await translationErrors(
        '<button aria-label="Show password" />',
        'src/components/ui/password-input.tsx',
      ),
    ).toHaveLength(1);
  });
});
