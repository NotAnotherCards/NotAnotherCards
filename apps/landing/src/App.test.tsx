import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends account calls to action to the canonical application subdomain', () => {
    render(<App />);

    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      'https://app.notanothercards.com/login',
    );

    for (const name of [
      'Get started',
      'Get started free',
      'Create your account',
    ]) {
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

    for (const element of Array.from(
      document.querySelectorAll('[href], [src]'),
    )) {
      const value = element.getAttribute('href') ?? element.getAttribute('src');
      expect(value).not.toMatch(/^\/(?:api|sync)(?:\/|$)/);
    }
  });

  it('renders word cards for an unknown route instead of the landing page', () => {
    window.history.replaceState({}, '', '/not-a-real-page');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'Page not found', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('4')).toHaveLength(2);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('Page')).toBeInTheDocument();
    expect(screen.getByText('not')).toBeInTheDocument();
    expect(screen.getByText('found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(document.title).toBe('NotAnotherCards — Page not found');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ships the approved metadata and canonical URL', () => {
    const metadataDocument = new DOMParser().parseFromString(
      indexHtml,
      'text/html',
    );

    expect(metadataDocument.title).toBe(
      'NotAnotherCards — Learn the words that matter most',
    );
    expect(
      metadataDocument
        .querySelector('meta[name="description"]')
        ?.getAttribute('content'),
    ).toBe(
      'Build useful vocabulary with smart flashcards, AI-powered context, offline learning, and sync across devices.',
    );
    expect(
      metadataDocument
        .querySelector('link[rel="canonical"]')
        ?.getAttribute('href'),
    ).toBe('https://notanothercards.com/');
    expect(
      metadataDocument
        .querySelector('meta[property="og:url"]')
        ?.getAttribute('content'),
    ).toBe('https://notanothercards.com/');
    expect(
      metadataDocument
        .querySelector('meta[property="og:image"]')
        ?.getAttribute('content'),
    ).toBe('https://notanothercards.com/brand/og-image.png');
    expect(
      metadataDocument
        .querySelector('meta[property="og:image:width"]')
        ?.getAttribute('content'),
    ).toBe('1200');
    expect(
      metadataDocument
        .querySelector('meta[property="og:image:height"]')
        ?.getAttribute('content'),
    ).toBe('630');
    expect(
      metadataDocument
        .querySelector('meta[property="og:image:alt"]')
        ?.getAttribute('content'),
    ).toBe('NotAnotherCards flashcards for learning useful vocabulary');
    expect(
      existsSync(resolve(process.cwd(), 'public/brand/og-image.png')),
    ).toBe(true);
  });
});
