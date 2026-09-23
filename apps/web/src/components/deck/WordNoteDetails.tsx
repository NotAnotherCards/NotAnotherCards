import { Button } from '@/components/ui/button';
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { WordNoteFields } from '@repo/offline-db';
import { List } from 'lucide-react';
import { WordNoteDialog } from './WordNoteDialog';
import { WordNoteDetailFields } from './WordNoteDetailFields';

interface WordNoteDetailsProps {
  fields: WordNoteFields;
  onClose: () => void;
}

export function WordNoteDetails({ fields, onClose }: WordNoteDetailsProps) {
  const hasDetails = Object.entries(fields).some(
    ([key, value]) =>
      ![
        'word',
        'translation',
        'native_language_id',
        'target_language_id',
      ].includes(key) && value,
  );

  return (
    <WordNoteDialog label="Extra info" onClose={onClose}>
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
        {hasDetails ? (
          <WordNoteDetailFields fields={fields} />
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
    </WordNoteDialog>
  );
}
