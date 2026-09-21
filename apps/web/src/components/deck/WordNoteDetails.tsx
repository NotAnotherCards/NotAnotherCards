import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { WordNoteFields } from '@repo/offline-db';
import { List } from 'lucide-react';

interface WordNoteDetailsProps {
  fields: WordNoteFields;
  onClose: () => void;
}

const detailFields = [
  ['Part of speech', 'part_of_speech'],
  ['Gender', 'gender'],
  ['Pronunciation', 'pronunciation'],
  ['Example', 'example'],
  ['Example translation', 'example_translation'],
  ['Notes', 'notes'],
] as const;

export function WordNoteDetails({ fields, onClose }: WordNoteDetailsProps) {
  const filledDetails = detailFields.filter(([, key]) => fields[key]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
    >
      <Card
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-lg lg:max-w-3xl shadow-2xl border border-border/80 animate-in zoom-in-95 duration-200"
      >
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <List className="size-4.5 text-primary" />
            Details
          </CardTitle>
          <CardDescription>
            Additional information saved for this word.
          </CardDescription>
        </CardHeader>
        <CardContent className="max-h-[60vh] overflow-y-auto pt-4">
          {filledDetails.length > 0 ? (
            <dl className="space-y-4 text-sm">
              {filledDetails.map(([label, key]) => (
                <div key={key}>
                  <dt className="text-xs font-medium text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words">
                    {fields[key]}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              No additional details are saved for this word.
            </p>
          )}
        </CardContent>
        <CardFooter className="border-t border-border/40 pt-4">
          <Button type="button" className="w-full" onClick={onClose}>
            Close
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
