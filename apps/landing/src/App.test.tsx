import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('sends account calls to action to the canonical application subdomain', () => {
    render(<App />);

    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      'https://app.notanothercards.com/login',
    );

    for (const name of ['Get started', 'Get started free', 'Create your account']) {
      expect(screen.getByRole('link', { name })).toHaveAttribute(
        'href',
        'https://app.notanothercards.com/register',
      );
    }
  });
});
