import React from 'react';
import { render } from '@testing-library/react-native';
import { useDatabase, useQuery } from '@remelondb/core/react';
import { useTranslation } from 'react-i18next';
import Storage from 'expo-sqlite/kv-store';
import LanguageEnforcer from '../lib/language-enforcer';
import { useSessionDatabase } from '../lib/database-provider';

jest.mock('../lib/database-provider', () => ({
  useSessionDatabase: jest.fn(),
}));

jest.mock('@remelondb/core/react', () => ({
  useDatabase: jest.fn(),
  useQuery: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(),
}));

jest.mock('expo-sqlite/kv-store', () => ({
  setItemSync: jest.fn(),
}));

jest.mock('@repo/offline-db', () => ({
  getUserProfileQuery: jest.fn(),
}));

describe('LanguageEnforcer', () => {
  const mockChangeLanguage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useSessionDatabase as jest.Mock).mockReturnValue({ manager: {} });
    (useDatabase as jest.Mock).mockReturnValue({});
    (useTranslation as jest.Mock).mockReturnValue({
      i18n: {
        resolvedLanguage: 'en',
        changeLanguage: mockChangeLanguage,
      },
    });
  });

  it('changes language to target language when target_language_active is true', () => {
    (useQuery as jest.Mock).mockReturnValue({
      data: [
        {
          target_language_active: true,
          target_language_id: '00000000-0000-0000-0000-000000000002', // Spanish
          native_language_id: '00000000-0000-0000-0000-000000000001', // English
        },
      ],
    });

    render(<LanguageEnforcer />);

    expect(mockChangeLanguage).toHaveBeenCalledWith('es');
    expect(Storage.setItemSync).toHaveBeenCalledWith('i18nextLng', 'es');
  });

  it('changes language to native language when target_language_active is false', () => {
    (useTranslation as jest.Mock).mockReturnValue({
      i18n: {
        resolvedLanguage: 'es',
        changeLanguage: mockChangeLanguage,
      },
    });

    (useQuery as jest.Mock).mockReturnValue({
      data: [
        {
          target_language_active: false,
          target_language_id: '00000000-0000-0000-0000-000000000002', // Spanish
          native_language_id: '00000000-0000-0000-0000-000000000001', // English
        },
      ],
    });

    render(<LanguageEnforcer />);

    expect(mockChangeLanguage).toHaveBeenCalledWith('en');
    expect(Storage.setItemSync).toHaveBeenCalledWith('i18nextLng', 'en');
  });

  it('does nothing if resolvedLanguage already matches', () => {
    (useTranslation as jest.Mock).mockReturnValue({
      i18n: {
        resolvedLanguage: 'es',
        changeLanguage: mockChangeLanguage,
      },
    });

    (useQuery as jest.Mock).mockReturnValue({
      data: [
        {
          target_language_active: true,
          target_language_id: '00000000-0000-0000-0000-000000000002', // Spanish
          native_language_id: '00000000-0000-0000-0000-000000000001', // English
        },
      ],
    });

    render(<LanguageEnforcer />);

    expect(mockChangeLanguage).not.toHaveBeenCalled();
    expect(Storage.setItemSync).not.toHaveBeenCalled();
  });
});
