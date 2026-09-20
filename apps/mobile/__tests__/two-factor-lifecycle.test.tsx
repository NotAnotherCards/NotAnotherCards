import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { TwoFactorLifecycle } from '@/components/two-factor-lifecycle';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockGetItem = jest.fn();
jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: unknown[]) => mockGetItem(...args),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

describe('two-factor startup lifecycle', () => {
  it('routes a persisted challenge after a process restart', async () => {
    mockGetItem.mockResolvedValueOnce('true');
    render(<TwoFactorLifecycle deepLinkPending={false} />);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/two-factor'),
    );
    expect(mockGetItem).toHaveBeenCalledWith(
      'notanothercards.pending-two-factor',
    );
  });
});
