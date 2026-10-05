const mockSetItemAsync = jest.fn();

jest.mock('expo-secure-store', () => ({
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
}));

import { clearLocalAuthStorage } from '@/lib/auth-storage';

describe('local auth storage fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetItemAsync.mockResolvedValue(undefined);
  });

  it('clears both persisted Expo auth values', async () => {
    await clearLocalAuthStorage();

    expect(mockSetItemAsync).toHaveBeenCalledWith(
      'notanothercards_cookie',
      '{}',
    );
    expect(mockSetItemAsync).toHaveBeenCalledWith(
      'notanothercards_session_data',
      '{}',
    );
  });
});
