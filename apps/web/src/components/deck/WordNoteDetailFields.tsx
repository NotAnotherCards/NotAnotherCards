import type { WordNoteFields } from '@repo/offline-db';
import { useTranslation } from 'react-i18next';

const fields = [
  ['Part of speech', 'part_of_speech'],
  ['Gender', 'gender'],
  ['Pronunciation', 'pronunciation'],
  ['Example', 'example'],
  ['Example translation', 'example_translation'],
  ['Notes', 'notes'],
] as const;

export function WordNoteDetailFields({
  fields: values,
}: {
  fields: WordNoteFields;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      {fields.map(([label, key]) => {
        const value = values[key];
        if (!value) return null;

        return (
          <dl key={key}>
            <dt className="text-xs font-medium text-muted-foreground">
              {t(`deck.word_form.${key}`, label)}
            </dt>
            <dd className="mt-1.5 min-h-9 rounded-lg border border-input bg-background px-3 py-2 text-sm whitespace-pre-wrap break-words">
              {value}
            </dd>
          </dl>
        );
      })}
    </div>
  );
}
