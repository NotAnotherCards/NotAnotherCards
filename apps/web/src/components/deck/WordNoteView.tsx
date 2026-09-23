import { Button } from '@/components/ui/button';
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { WordNoteFields } from '@repo/offline-db';
import { Eye, Pencil } from 'lucide-react';
import { WordNoteDialog } from './WordNoteDialog';
import { WordNoteDetailFields } from './WordNoteDetailFields';

interface WordNoteViewProps {
  fields: WordNoteFields;
  onClose: () => void;
  onEdit: () => void;
}

export function WordNoteView({ fields, onClose, onEdit }: WordNoteViewProps) {
  const displayFieldClass =
    'min-h-9 rounded-lg border border-input bg-background px-3 py-2 text-sm whitespace-pre-wrap break-words';

  return (
    <WordNoteDialog label="View Note" onClose={onClose}>
      <CardHeader className="border-b border-border/40 pb-4">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Eye className="size-4.5 text-primary" />
          View Note
        </CardTitle>
        <CardDescription>All details saved for this word.</CardDescription>
      </CardHeader>
      <CardContent className="max-h-[60vh] overflow-y-auto pt-4">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Word</p>
            <div className={`mt-1.5 ${displayFieldClass}`}>{fields.word}</div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Translation
            </p>
            <div className={`mt-1.5 ${displayFieldClass}`}>
              {fields.translation}
            </div>
          </div>
          <WordNoteDetailFields fields={fields} />
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 border-t border-border/40 pt-4">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onClose}
        >
          Close
        </Button>
        <Button type="button" className="flex-1 gap-1.5" onClick={onEdit}>
          <Pencil className="size-3.5" />
          Edit Note
        </Button>
      </CardFooter>
    </WordNoteDialog>
  );
}
