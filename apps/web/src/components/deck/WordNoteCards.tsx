import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Layers } from 'lucide-react';

interface WordNoteCardsProps {
  cards: readonly string[];
  onClose: () => void;
}

export function WordNoteCards({ cards, onClose }: WordNoteCardsProps) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <Card
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-lg border border-border/80 shadow-2xl animate-in zoom-in-95 duration-200"
      >
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
      </Card>
    </div>
  );
}
