import type { WordNoteFields } from '@repo/offline-db';

const fields = [
  ['Part of speech', 'part_of_speech'],
  ['Gender', 'gender'],
  ['Pronunciation', 'pronunciation'],
  ['Example', 'example'],
  ['Example translation', 'example_translation'],
  ['Notes', 'notes'],
  ['Image', 'image'],
  ['Audio', 'word_audio'],
] as const;

export function WordNoteDetailFields({
  fields: values,
}: {
  fields: WordNoteFields;
}) {
  return (
    <div className="space-y-4">
      {fields.map(([label, key]) => {
        const value = values[key];
        if (!value) return null;

        return (
          <dl key={key}>
            <dt className="text-xs font-medium text-muted-foreground">
              {label}
            </dt>
            <dd className="mt-1.5 min-h-9 rounded-lg border border-input bg-background px-3 py-2 text-sm whitespace-pre-wrap break-words">
              {key === 'image' ? (
                <img src={value} alt="Word" className="max-h-48 rounded-md" />
              ) : key === 'word_audio' ? (
                <audio controls src={value} className="w-full" />
              ) : (
                value
              )}
            </dd>
          </dl>
        );
      })}
    </div>
  );
}
