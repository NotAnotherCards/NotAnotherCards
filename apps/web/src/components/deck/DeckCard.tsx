import { useTranslation } from 'react-i18next';
import { Deck } from '@/hooks/useStore';
import { deckKindClassName } from './deck-kind';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { BookOpen, Edit, Trash2, FolderOpen } from 'lucide-react';
import {
  deckKindShort,
  noteTypeRegistry,
  WORD_NOTE_TYPE,
} from '@repo/offline-db';
import { deckTypeAccessibilityLabel } from '@repo/i18n';

interface DeckCardProps {
  deck: Deck;
  totalCards: number;
  activeCards?: number;
  totalWords?: number;
  activeWords?: number;
  dueCount: number;
  /** Cards not yet activated; the review page is where they are activated. */
  inactiveCards?: number;
  onSelectDeck: (deckId: string) => void;
  onStartReview: (deckId: string) => void;
  onEditDeck: (deck: Deck) => void;
  onDeleteDeck: (deckId: string) => void;
}

export function DeckCard({
  deck,
  totalCards,
  activeCards = 0,
  totalWords,
  activeWords,
  dueCount,
  inactiveCards = 0,
  onSelectDeck,
  onStartReview,
  onEditDeck,
  onDeleteDeck,
}: DeckCardProps) {
  // A deck whose note type this client does not know is not editable here.
  // A push sends the client's whole view of a row, so rewriting one a newer
  // client wrote could drop columns this schema has never heard of. Delete
  // stays: a tombstone carries ids only, so there is nothing to lose, and it
  // is the only way to be rid of a deck this client cannot use.
  const isKnownType = deck.note_type in noteTypeRegistry;
  const { t, i18n } = useTranslation();
  const kindLabel = deckTypeAccessibilityLabel(
    deck,
    i18n.resolvedLanguage ?? i18n.language,
    (key, options) => t(`deck.type.${key}`, options),
  );

  return (
    <Card className="group hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
      <CardHeader className="min-w-0 pb-3">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex flex-1 items-center gap-2 min-w-0">
            <span
              className={`${deckKindClassName} inline-flex h-6 shrink-0 items-center whitespace-nowrap font-medium leading-none`}
              data-testid="deck-kind"
              title={kindLabel}
              aria-label={kindLabel}
            >
              {deckKindShort(deck)}
            </span>
            <CardTitle
              className="text-base font-bold group-hover:text-pine transition-colors cursor-pointer truncate"
              onClick={() => onSelectDeck(deck.id)}
              title={deck.title}
            >
              {deck.title}
            </CardTitle>
          </div>
          <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
            {isKnownType && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-lg cursor-pointer hover:bg-muted text-muted-foreground hover:text-foreground"
                onClick={() => onEditDeck(deck)}
                title={t('deck.card.actions.edit')}
              >
                <Edit className="size-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg cursor-pointer hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              onClick={() => onDeleteDeck(deck.id)}
              title={t('deck.card.actions.delete')}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs line-clamp-2 min-h-8 mt-1">
          {deck.description || t('deck.card.no_description')}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 divide-x divide-border/40 gap-2 rounded-2xl border border-border/30 bg-muted/40 px-3 py-2 text-center">
          {deck.note_type === WORD_NOTE_TYPE ? (
            <>
              <Count
                label={t('deck.card.total_words', 'Total Words')}
                value={totalWords ?? 0}
                testId="total-words-badge"
              />
              <Count
                label={t('deck.card.active_words', 'Active Words')}
                value={activeWords ?? 0}
                testId="active-words-badge"
              />
              <Count
                label={t('deck.card.due')}
                value={dueCount}
                work
                testId="due-cards-badge"
              />
            </>
          ) : (
            <>
              <Count
                label={t('deck.card.cards', 'Cards')}
                value={totalCards}
                testId="total-cards-badge"
              />
              <Count
                label={t('deck.card.active', 'Active')}
                value={activeCards}
                testId="active-cards-badge"
              />
              <Count
                label={t('deck.card.due_short', 'Due')}
                value={dueCount}
                work
                testId="due-cards-badge"
              />
            </>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={() => onSelectDeck(deck.id)}
            className="w-full cursor-pointer gap-1.5"
            size="sm"
          >
            <FolderOpen className="size-3.5" />
            {t('deck.card.actions.manage_cards', 'Manage Cards')}
          </Button>
          {/* Off when nothing is due and no card is left to activate: the
              review page is where cards are activated, so a deck with
              inactive cards keeps its way in. */}
          <Button
            variant="outline"
            disabled={dueCount === 0 && inactiveCards === 0}
            onClick={() => onStartReview(deck.id)}
            className="w-full cursor-pointer gap-1.5"
            size="sm"
          >
            <BookOpen className="size-3.5" />
            {t('deck.card.actions.start_review', 'Start Review')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Any zero is faded, so the figures that say something stand out. `work`
// marks the due count, accented while there is something to review.
function Count({
  label,
  value,
  work = false,
  testId,
}: {
  label: string;
  value: number;
  work?: boolean;
  testId: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center">
      <div className="flex min-h-8 items-center justify-center text-xs leading-4 font-medium text-foreground">
        {label}
      </div>
      <span
        className={`text-sm font-bold tabular-nums ${
          value === 0
            ? 'text-muted-foreground'
            : work
              ? 'text-primary'
              : 'text-foreground'
        }`}
        data-testid={testId}
      >
        {value}
      </span>
    </div>
  );
}
