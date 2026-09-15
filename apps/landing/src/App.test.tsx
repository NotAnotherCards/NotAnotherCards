import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

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

  it('does not initialize network requests or link to API and sync routes', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(fetchMock).not.toHaveBeenCalled();

    for (const element of Array.from(document.querySelectorAll('[href], [src]'))) {
      const value = element.getAttribute('href') ?? element.getAttribute('src');
      expect(value).not.toMatch(/^\/(?:api|sync)(?:\/|$)/);
    }

    vi.unstubAllGlobals();
  });

  it('ships the approved metadata and canonical URL', () => {
    const metadataDocument = new DOMParser().parseFromString(indexHtml, 'text/html');

    expect(metadataDocument.title).toBe(
      'NotAnotherCards — Learn the words that matter most',
    );
    expect(
      metadataDocument.querySelector('meta[name="description"]')?.getAttribute('content'),
    ).toBe(
      'Build useful vocabulary with smart flashcards, AI-powered context, offline learning, and sync across devices.',
    );
    expect(
      metadataDocument.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    ).toBe('https://notanothercards.com/');
    expect(
      metadataDocument.querySelector('meta[property="og:url"]')?.getAttribute('content'),
    ).toBe('https://notanothercards.com/');
  });
});
