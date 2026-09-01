import { render, screen, act } from '@testing-library/react';
import { App, router } from '../App';
import { beforeEach, describe, expect, it } from 'vitest';

describe('App', () => {
  beforeEach(async () => {
    // Reset router history and path directly to home
    window.history.pushState(null, '', '/');
    await act(async () => {
      await router.navigate({ to: '/' });
    });
  });

  it('redirects to the login page by default when logged out', async () => {
    render(<App />);

    expect(
      await screen.findByRole('heading', { name: /Welcome Back/i }),
    ).toBeInTheDocument();
  });
});
