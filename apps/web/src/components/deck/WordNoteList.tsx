import { useMemo, useState, type CSSProperties } from 'react';
import type { Card } from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card as UICard,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Edit, Eye, HelpCircle, Library, Search, Unlink } from 'lucide-react';
import { countCards, countWords, type UserNoteRecord } from '@repo/offline-db';
import { WordNoteCards } from './WordNoteCards';
import { toWordRow, type WordRow } from './word-note-rows';

// These container thresholds preserve readable Word and Translation columns
// before Cards changes from badges to a number and then to the post-row view.
const WORD_TABLE_LAYOUT = {
  postRow: '848px',
  compactCards: '1030px',
  threeBadges: '1140px',
  allBadges: '1250px',
  wordColumnMinimum: '260px',
  extraInfoColumn: '76px',
  actionsColumn: '108px',
  twoBadgesWidth: '13.375rem',
  threeBadgesWidth: '20.25rem',
  fourBadgesWidth: '27.125rem',
} as const;

interface WordNoteListProps {
  notes: UserNoteRecord[];
  cards: Card[];
  dueCount: number;
  onViewNote: (card: Card) => void;
  onViewDetails: (note: UserNoteRecord) => void;
  onEditWord: (card: Card) => void;
  onRemoveWord: (card: Card) => void;
  canEdit: boolean;
  canRemove: boolean;
  onAddWord: () => void;
}

export function WordNoteList({
  notes,
  cards,
  dueCount,
  onViewNote,
  onViewDetails,
  onEditWord,
  onRemoveWord,
  canEdit,
  canRemove,
  onAddWord,
}: WordNoteListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingCards, setViewingCards] = useState<readonly string[] | null>(
    null,
  );
  const rows = useMemo(
    () =>
      notes
        .map((note) => toWordRow(note, cards))
        .filter((row): row is WordRow => row !== null),
    [notes, cards],
  );
  const filteredRows = rows.filter(({ word, translation }) => {
    const search = searchTerm.toLowerCase();
    return (
      word.toLowerCase().includes(search) ||
      translation.toLowerCase().includes(search)
    );
  });
  const maximumBadgeCount = Math.max(
    2,
    ...rows.map((row) => row.badges.length),
  );
  const cardsColumnFullWidth =
    maximumBadgeCount === 4
      ? WORD_TABLE_LAYOUT.fourBadgesWidth
      : maximumBadgeCount === 3
        ? WORD_TABLE_LAYOUT.threeBadgesWidth
        : WORD_TABLE_LAYOUT.twoBadgesWidth;
  const cardsColumnThreeBadgesWidth =
    maximumBadgeCount === 4
      ? WORD_TABLE_LAYOUT.threeBadgesWidth
      : cardsColumnFullWidth;
  const tableStyle: CSSProperties &
    Record<
      | '--cards-column-full'
      | '--cards-column-three'
      | '--word-column-min'
      | '--extra-info-column'
      | '--actions-column',
      string
    > = {
    '--cards-column-full': cardsColumnFullWidth,
    '--cards-column-three': cardsColumnThreeBadgesWidth,
    '--word-column-min': WORD_TABLE_LAYOUT.wordColumnMinimum,
    '--extra-info-column': WORD_TABLE_LAYOUT.extraInfoColumn,
    '--actions-column': WORD_TABLE_LAYOUT.actionsColumn,
  };
  return (
    <UICard className="border border-border/60">
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex flex-nowrap items-center gap-x-4 text-base font-bold whitespace-nowrap">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <Library className="size-4 text-primary" />
            {countWords(filteredRows)} Words
          </CardTitle>
          <span>{countCards(cards)} Cards</span>
          <span>{dueCount} Cards Due</span>
        </div>
        <div className="relative mt-4 w-full md:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search word, translation..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground min-h-50 gap-4">
            <HelpCircle className="size-10 mb-2 stroke-1 opacity-60" />
            <p className="text-sm font-semibold">No Words Found</p>
            <p className="text-xs max-w-xs mt-1">
              {searchTerm
                ? 'Try refining your search term to find a word in this deck.'
                : 'This deck is empty. Click Add Word above to start building your collection.'}
            </p>
            {!searchTerm && notes.length === 0 && (
              <Button onClick={onAddWord} className="cursor-pointer">
                Add Word
              </Button>
            )}
          </div>
        ) : (
          <div className="@container">
            <div
              role="table"
              aria-label="Word Catalog"
              style={tableStyle}
              className="[--cards-column:2rem] @[1030px]:[--cards-column:13.375rem] @[1140px]:[--cards-column:var(--cards-column-three)] @[1250px]:[--cards-column:var(--cards-column-full)]"
            >
              <div role="rowgroup">
                <div
                  role="row"
                  className="sr-only @[848px]:not-sr-only @[848px]:grid @[848px]:grid-cols-[minmax(var(--word-column-min),1fr)_minmax(var(--word-column-min),1fr)_var(--cards-column)_var(--extra-info-column)_var(--actions-column)] gap-4 @[848px]:!px-6 @[848px]:!py-3 border-b border-border/40 bg-muted/20 text-xs font-semibold text-muted-foreground"
                >
                  <div role="columnheader">Word</div>
                  <div role="columnheader">Translation</div>
                  <div role="columnheader" className="text-center">
                    Cards
                  </div>
                  <div role="columnheader" className="text-center">
                    Extra info
                  </div>
                  <div role="columnheader" className="text-center">
                    Actions
                  </div>
                </div>
              </div>
              <div role="rowgroup">
                {filteredRows.map((row, index) => (
                  <div
                    key={row.note.id}
                    role="row"
                    aria-rowindex={index + 2}
                    className="grid grid-cols-1 @[848px]:grid-cols-[minmax(var(--word-column-min),1fr)_minmax(var(--word-column-min),1fr)_var(--cards-column)_var(--extra-info-column)_var(--actions-column)] gap-3 @[848px]:gap-4 px-6 py-4 border-b border-border/30 hover:bg-muted/10 transition-colors last:border-0"
                  >
                    <div
                      role="cell"
                      className="min-w-0 truncate font-medium"
                      title={row.word}
                    >
                      {row.actionCard ? (
                        <button
                          type="button"
                          className="max-w-full cursor-pointer truncate text-left hover:text-primary"
                          onClick={() => onViewNote(row.actionCard!)}
                          title="View Note"
                        >
                          {row.word}
                        </button>
                      ) : (
                        row.word
                      )}
                    </div>
                    <div
                      role="cell"
                      className="text-muted-foreground min-w-0 truncate"
                      title={row.translation}
                    >
                      {row.translation}
                    </div>
                    <div className="grid grid-cols-[minmax(4.5rem,1fr)_minmax(5rem,1fr)_minmax(10rem,1fr)] items-center gap-3 @[556px]:grid-cols-[minmax(15.625rem,1fr)_minmax(5rem,1fr)_minmax(10rem,1fr)] @[848px]:contents">
                      <div
                        role="cell"
                        className="flex min-w-0 items-center gap-2 @[848px]:block @[848px]:self-center"
                        aria-label={`${row.cards.length} cards`}
                      >
                        <button
                          type="button"
                          className="text-left text-xs font-semibold text-muted-foreground hover:text-primary cursor-pointer @[556px]:hidden"
                          onClick={() => setViewingCards(row.badges)}
                          aria-label={`View ${row.cards.length} cards`}
                        >
                          Cards:
                        </button>
                        <span className="hidden text-left text-xs font-semibold text-muted-foreground @[556px]:block @[848px]:hidden">
                          Cards:
                        </span>
                        <span className="hidden min-w-0 text-left text-xs leading-6 text-muted-foreground @[556px]:block @[848px]:hidden">
                          {row.badges.map((badge, index) => (
                            <span key={badge} className="whitespace-nowrap">
                              {index > 0 && ' · '}
                              {badge}
                            </span>
                          ))}
                        </span>
                        <button
                          type="button"
                          className="text-left text-xs text-muted-foreground hover:text-primary cursor-pointer @[556px]:hidden"
                          onClick={() => setViewingCards(row.badges)}
                          aria-label={`View ${row.cards.length} cards`}
                        >
                          {row.cards.length}
                        </button>
                        <button
                          type="button"
                          className="hidden mx-auto text-center text-xs text-muted-foreground hover:text-primary cursor-pointer @[848px]:block @[1030px]:hidden"
                          onClick={() => setViewingCards(row.badges)}
                          aria-label={`View ${row.cards.length} cards`}
                        >
                          {row.cards.length}
                        </button>
                        <div className="hidden min-w-[13.375rem] flex-wrap gap-1.5 @[1030px]:flex">
                          {row.badges.map((badge) => (
                            <span
                              key={badge}
                              className="inline-flex h-7 w-[6.5rem] shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/35 px-2 text-xs font-medium text-muted-foreground"
                            >
                              {badge}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="contents">
                        <div
                          role="cell"
                          className="flex min-w-0 items-center justify-center gap-2 @[848px]:justify-self-center"
                        >
                          <button
                            type="button"
                            className="text-xs font-semibold text-muted-foreground hover:text-primary cursor-pointer @[848px]:hidden"
                            onClick={() => onViewDetails(row.note)}
                            aria-label={`View ${row.detailsCount} details`}
                          >
                            Extra info:
                          </button>
                          <button
                            type="button"
                            className="text-left text-xs text-muted-foreground hover:text-primary cursor-pointer"
                            onClick={() => onViewDetails(row.note)}
                            aria-label={`View ${row.detailsCount} details`}
                          >
                            {row.detailsCount}
                          </button>
                        </div>
                        <div
                          role="cell"
                          className="flex min-w-0 items-center justify-start gap-2 @[848px]:justify-center"
                        >
                          <span className="text-xs font-semibold text-muted-foreground @[848px]:hidden">
                            Actions:
                          </span>
                          <div className="flex items-center gap-1.5">
                            {row.actionCard && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground"
                                onClick={() => onViewNote(row.actionCard!)}
                                title="View Note"
                              >
                                <Eye className="size-3.5" />
                              </Button>
                            )}
                            {canEdit && row.actionCard && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground"
                                onClick={() => onEditWord(row.actionCard!)}
                                title="Edit Note"
                              >
                                <Edit className="size-3.5" />
                              </Button>
                            )}
                            {canRemove && row.actionCard && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 rounded-lg cursor-pointer text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={() => onRemoveWord(row.actionCard!)}
                                title="Remove Word"
                              >
                                <Unlink className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
      {viewingCards && (
        <WordNoteCards
          cards={viewingCards}
          onClose={() => setViewingCards(null)}
        />
      )}
    </UICard>
  );
}
