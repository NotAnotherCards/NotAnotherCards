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
import { useTranslation } from 'react-i18next';

interface WordNoteViewProps {
  fields: WordNoteFields;
  cards: readonly string[];
  onClose: () => void;
  onEdit: () => void;
}

export function WordNoteView({
  fields,
  cards,
  onClose,
  onEdit,
}: WordNoteViewProps) {
  const { t } = useTranslation();
  const displayFieldClass =
    'min-h-9 rounded-lg border border-input bg-background px-3 py-2 text-sm whitespace-pre-wrap break-words';

  return (
    <WordNoteDialog
      label={t('deck.words.view_word', 'View Word')}
      onClose={onClose}
    >
      <CardHeader className="border-b border-border/40 pb-4">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Eye className="size-4.5 text-primary" />
          {t('deck.words.view_word', 'View Word')}
        </CardTitle>
        <CardDescription>
          {t('deck.word_view.desc', 'All details saved for this word.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="max-h-[60vh] overflow-y-auto pt-4">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {t('deck.word_form.word_label', 'Word')}
            </p>
            <div className={`mt-1.5 ${displayFieldClass}`}>{fields.word}</div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {t('deck.word_form.translation_label', 'Translation')}
            </p>
            <div className={`mt-1.5 ${displayFieldClass}`}>
              {fields.translation}
            </div>
          </div>
          <WordNoteDetailFields fields={fields} />
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {t('deck.word_view.cards_count', 'Cards ({{count}})', {
                count: cards.length,
              })}
            </p>
            <div className="mt-1.5 space-y-2">
              {cards.map((card) => (
                <div key={card} className={displayFieldClass}>
                  {card}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 border-t border-border/40 pt-4">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onClose}
        >
          {t('common.close', 'Close')}
        </Button>
        <Button type="button" className="flex-1 gap-1.5" onClick={onEdit}>
          <Pencil className="size-3.5" />
          {t('deck.word_view.edit_word', 'Edit Word')}
        </Button>
      </CardFooter>
    </WordNoteDialog>
  );
}
