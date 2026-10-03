import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { ThemeToggle } from '@/components/theme-toggle';
import { loadThemePreference } from '@/lib/theme';
import { renderWithLocale } from '@/lib/test-utils/render-with-locale';

it('labels the theme choices in German and saves the selected theme', async () => {
  const screen = await renderWithLocale(<ThemeToggle />, 'de');
  expect(screen.getByLabelText('Design')).toBeTruthy();
  fireEvent.press(screen.getByText('Dunkel'));
  expect(loadThemePreference()).toBe('dark');
});
