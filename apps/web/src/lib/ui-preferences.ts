import { z } from 'zod';

const uiPreferencesSchema = z.object({
  useTargetLanguageForUi: z.boolean().catch(false),
});

export type UiPreferences = z.infer<typeof uiPreferencesSchema>;

export const DEFAULT_UI_PREFERENCES: Readonly<UiPreferences> = {
  useTargetLanguageForUi: false,
};

export function uiPreferencesStorageKey(userId: string) {
  return `not-another-cards:ui-preferences:${userId}`;
}

export function parseUiPreferences(savedValue: string | null): UiPreferences {
  if (!savedValue) return { ...DEFAULT_UI_PREFERENCES };

  try {
    const parsedValue: unknown = JSON.parse(savedValue);
    const result = uiPreferencesSchema.safeParse(parsedValue);
    if (result.success) {
      return result.data;
    }
    return { ...DEFAULT_UI_PREFERENCES };
  } catch {
    return { ...DEFAULT_UI_PREFERENCES };
  }
}

function getUiStorage() {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function getUiPreferences(userId: string | undefined): UiPreferences {
  if (!userId) return { ...DEFAULT_UI_PREFERENCES };

  const storage = getUiStorage();
  if (!storage) return { ...DEFAULT_UI_PREFERENCES };

  try {
    return parseUiPreferences(storage.getItem(uiPreferencesStorageKey(userId)));
  } catch {
    return { ...DEFAULT_UI_PREFERENCES };
  }
}

export function saveUiPreferences(
  userId: string | undefined,
  preferences: UiPreferences,
) {
  if (!userId) return;

  const storage = getUiStorage();
  if (!storage) return;

  try {
    storage.setItem(
      uiPreferencesStorageKey(userId),
      JSON.stringify(preferences),
    );
    window.dispatchEvent(new CustomEvent('uiPreferencesChanged'));
  } catch {
    // UI works without saved browser preferences.
  }
}
