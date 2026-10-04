import { Button } from '@/components/ui/button';
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Eye, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { WordNoteDialog } from './WordNoteDialog';

interface BasicCardViewProps {
  front: string;
  back: string;
  onClose: () => void;
  onEdit: () => void;
}

export function BasicCardView({
  front,
  back,
  onClose,
  onEdit,
}: BasicCardViewProps) {
  const { t } = useTranslation();
  const displayFieldClass =
    'min-h-9 rounded-lg border border-input bg-background px-3 py-2 text-sm whitespace-pre-wrap break-words';

  return (
    <WordNoteDialog
      label={t('deck.no_deck.view_card', 'View Card')}
      onClose={onClose}
    >
      <CardHeader className="border-b border-border/40 pb-4">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Eye className="size-4.5 text-primary" />
          {t('deck.no_deck.view_card', 'View Card')}
        </CardTitle>
        <CardDescription>
          {t(
            'deck.no_deck.view_card_description',
            'Question and answer saved for this card.',
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="max-h-[60vh] overflow-y-auto pt-4">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {t('deck.no_deck.question', 'Question')}
            </p>
            <div className={`mt-1.5 ${displayFieldClass}`}>{front}</div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {t('deck.no_deck.answer', 'Answer')}
            </p>
            <div className={`mt-1.5 ${displayFieldClass}`}>{back}</div>
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
          {t('deck.no_deck.edit_card', 'Edit Card')}
        </Button>
      </CardFooter>
    </WordNoteDialog>
  );
}
