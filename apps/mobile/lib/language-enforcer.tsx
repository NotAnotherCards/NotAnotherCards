import { useDatabase, useQuery } from '@remelondb/core/react';
import { getUserProfileQuery } from '@repo/offline-db';
import type { UserProfileRecord } from '@repo/offline-db';
import { languageFor } from '@repo/schemas';
import Storage from 'expo-sqlite/kv-store';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseManager } from '@remelondb/core';

/**
 * Keeps the mobile app's UI language synchronized with the user's profile preferences.
 * Watches the local offline database for changes to the target/native language selection,
 * applies them to i18next, and caches the result for future offline boots.
 */
function LanguageEnforcer({ manager }: { manager: DatabaseManager }) {
  const db = useDatabase(manager);
  const profiles = useQuery<UserProfileRecord>(db && getUserProfileQuery(db));
  const { i18n } = useTranslation();

  useEffect(() => {
    const profile = profiles.data[0];
    if (!profile) return;

    const useTargetActive = profile.target_language_active ?? false;
    const languageId = useTargetActive
      ? profile.target_language_id
      : profile.native_language_id;

    if (languageId) {
      const locale = languageFor(languageId)?.locale;
      if (locale && i18n.resolvedLanguage !== locale) {
        void i18n.changeLanguage(locale);
        Storage.setItemSync('i18nextLng', locale);
      }
    }
  }, [profiles.data, i18n]);

  return null;
}

export default LanguageEnforcer;
