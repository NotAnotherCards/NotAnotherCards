import { Button } from '@/components/ui/button';
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Layers } from 'lucide-react';
import { WordNoteDialog } from './WordNoteDialog';

interface WordNoteCardsProps {
  cards: readonly string[];
  onClose: () => void;
}

export function WordNoteCards({ cards, onClose }: WordNoteCardsProps) {
  return (
    <WordNoteDialog label="Cards" onClose={onClose}>
      <CardHeader className="border-b border-border/40 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg font-bold">
          <Layers className="size-4.5 text-primary" />
          Cards
        </CardTitle>
        <CardDescription>Cards created to review this word.</CardDescription>
      </CardHeader>
      <CardContent className="max-h-[60vh] space-y-3 overflow-y-auto pt-4">
        {cards.map((card) => (
          <div
            key={card}
            className="min-h-9 rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            {card}
          </div>
        ))}
      </CardContent>
      <CardFooter className="border-t border-border/40 pt-4">
        <Button type="button" className="w-full" onClick={onClose}>
          Close
        </Button>
      </CardFooter>
    </WordNoteDialog>
  );
}
