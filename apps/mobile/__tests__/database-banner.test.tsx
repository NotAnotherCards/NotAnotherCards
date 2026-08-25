import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DatabaseBanner } from '@/components/database-banner';
import { manager } from '@/lib/db';

const mockUseDatabaseState = jest.fn();

jest.mock('@remelondb/core/react', () => ({
  useDatabaseState: () => mockUseDatabaseState(),
}));

jest.mock('../lib/db', () => ({
  manager: { init: jest.fn().mockResolvedValue(undefined) },
}));

describe('DatabaseBanner', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(['idle', 'loading', 'ready'])('renders nothing when %s', (status) => {
    mockUseDatabaseState.mockReturnValue({ status, error: null });

    const { toJSON } = render(<DatabaseBanner />);

    expect(toJSON()).toBeNull();
  });

  it('warns and retries when the database failed to open', () => {
    mockUseDatabaseState.mockReturnValue({
      status: 'error',
      error: new Error('nope'),
    });

    const { getByText } = render(<DatabaseBanner />);
    expect(getByText(/Offline database unavailable/)).toBeTruthy();

    fireEvent.press(getByText('Retry'));
    expect(manager.init).toHaveBeenCalled();
  });
});
