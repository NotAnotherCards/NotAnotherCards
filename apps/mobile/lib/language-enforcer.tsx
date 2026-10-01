import { useDatabase, useQuery } from '@remelondb/core/react';
import { getUserProfileQuery, type UserProfileRecord } from '@repo/offline-db';
import { languageFor } from '@repo/schemas';
import Storage from 'expo-sqlite/kv-store';
import { useSessionDatabase } from './database-provider';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

function LanguageEnforcer() {
  const manager = useSessionDatabase().manager;
  const db = useDatabase(manager!);
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
