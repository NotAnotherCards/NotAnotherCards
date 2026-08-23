import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DatabaseBanner } from '@/components/database-banner';

const mockUseDatabaseState = jest.fn();
const mockManager = { init: jest.fn().mockResolvedValue(undefined) };
let mockActiveManager: typeof mockManager | null = mockManager;

jest.mock('@remelondb/core/react', () => ({
  useDatabaseState: (manager: unknown) => mockUseDatabaseState(manager),
}));

jest.mock('../lib/database-provider', () => ({
  useSessionDatabase: () => ({ manager: mockActiveManager }),
}));

describe('DatabaseBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveManager = mockManager;
  });

  it('renders nothing without an active manager', () => {
    mockActiveManager = null;

    const { toJSON } = render(<DatabaseBanner />);

    expect(toJSON()).toBeNull();
    expect(mockUseDatabaseState).not.toHaveBeenCalled();
  });

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
    expect(mockManager.init).toHaveBeenCalled();
  });
});
