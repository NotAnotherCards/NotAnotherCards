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
import { Eye, Pencil } from 'lucide-react';

interface WordNoteViewProps {
  fields: WordNoteFields;
  onClose: () => void;
  onEdit: () => void;
}

export function WordNoteView({ fields, onClose, onEdit }: WordNoteViewProps) {
  const displayFieldClass =
    'min-h-9 rounded-lg border border-input bg-background px-3 py-2 text-sm whitespace-pre-wrap break-words';

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
            <Eye className="size-4.5 text-primary" />
            View Note
          </CardTitle>
          <CardDescription>All details saved for this word.</CardDescription>
        </CardHeader>
        <CardContent className="max-h-[60vh] overflow-y-auto pt-4">
          <dl className="space-y-4">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Word</dt>
              <dd className={`mt-1.5 ${displayFieldClass}`}>{fields.word}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Translation</dt>
              <dd className={`mt-1.5 ${displayFieldClass}`}>{fields.translation}</dd>
            </div>
            {fields.pronunciation && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Pronunciation</dt>
                <dd className={`mt-1.5 ${displayFieldClass}`}>{fields.pronunciation}</dd>
              </div>
            )}
            {fields.gender && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Gender</dt>
                <dd className={`mt-1.5 ${displayFieldClass}`}>{fields.gender}</dd>
              </div>
            )}
            {fields.part_of_speech && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Part of speech</dt>
                <dd className={`mt-1.5 ${displayFieldClass}`}>{fields.part_of_speech}</dd>
              </div>
            )}
            {(fields.example || fields.example_translation) && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Example</dt>
                <dd className={`mt-1.5 ${displayFieldClass}`}>
                  {fields.example && <p>{fields.example}</p>}
                  {fields.example_translation && (
                    <p className={fields.example ? 'mt-2 border-t border-border/60 pt-2 text-muted-foreground' : 'text-muted-foreground'}>
                      {fields.example_translation}
                    </p>
                  )}
                </dd>
              </div>
            )}
            {fields.notes && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Notes</dt>
                <dd className={`mt-1.5 ${displayFieldClass}`}>{fields.notes}</dd>
              </div>
            )}
          </dl>
        </CardContent>
        <CardFooter className="flex gap-2 border-t border-border/40 pt-4">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
          <Button type="button" className="flex-1 gap-1.5" onClick={onEdit}>
            <Pencil className="size-3.5" />
            Edit Note
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
