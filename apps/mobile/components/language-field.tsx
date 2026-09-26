import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, languageLabel } from '@repo/schemas';
import { Text } from './ui/text';

export function LanguageField({
  label,
  value,
  onChange,
  error,
  exclude,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  exclude?: string;
}) {
  const { t } = useTranslation();
  return (
    <View className="gap-1">
      <Text className="text-sm font-medium">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {LANGUAGES.map((language) => {
          const selected = language.value === value;
          const disabled = language.value === exclude;
          return (
            <Pressable
              key={language.value}
              accessibilityRole="radio"
              accessibilityLabel={`${label}: ${languageLabel(language)}`}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              className={`basis-[48%] rounded-lg border px-3 py-2 ${
                selected ? 'border-primary bg-accent' : 'border-input'
              } ${disabled ? 'opacity-40' : ''}`}
              onPress={() => onChange(language.value)}
            >
              <Text className={selected ? 'font-semibold text-primary' : ''}>
                {languageLabel(language)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error && (
        <Text className="text-sm text-destructive">
          {t(error, { defaultValue: error })}
        </Text>
      )}
    </View>
  );
}
