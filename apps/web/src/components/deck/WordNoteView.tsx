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

const detailFields = [
  ['Part of speech', 'part_of_speech'],
  ['Gender', 'gender'],
  ['Pronunciation', 'pronunciation'],
  ['Example', 'example'],
  ['Example translation', 'example_translation'],
  ['Notes', 'notes'],
] as const;

export function WordNoteView({ fields, onClose, onEdit }: WordNoteViewProps) {
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
        <CardContent className="max-h-[60vh] overflow-y-auto pt-4 space-y-4">
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Word</dt>
              <dd className="mt-1 font-medium break-words">{fields.word}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Translation</dt>
              <dd className="mt-1 break-words">{fields.translation}</dd>
            </div>
            {detailFields.map(([label, key]) =>
              fields[key] ? (
                <div key={key}>
                  <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words">{fields[key]}</dd>
                </div>
              ) : null,
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
