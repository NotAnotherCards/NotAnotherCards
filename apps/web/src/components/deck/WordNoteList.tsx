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
import {
  AlertCircle,
  Edit,
  Eye,
  HelpCircle,
  Library,
  Search,
  Unlink,
} from 'lucide-react';
import { type UserNoteRecord } from '@repo/offline-db';
import {
  toWordListRow,
  type InvalidWordRow,
  type WordListRow,
} from './word-note-rows';
import { type RecoverableWordFields } from './word-note-fields';
import { WordNoteDialog } from './WordNoteDialog';

// Word rows switch once: a stacked layout below 880px and a table above it.
const WORD_TABLE_LAYOUT = {
  wordColumnMinimum: '260px',
  cardsColumn: '4rem',
  extraInfoColumn: '76px',
  actionsColumn: '108px',
} as const;
const EMPTY_CARDS: readonly Card[] = [];

interface WordNoteListProps {
  notes: UserNoteRecord[];
  cards: Card[];
  dueCards: Card[];
  onViewNote: (note: UserNoteRecord) => void;
  onEditWord: (note: UserNoteRecord) => void;
  onRepairWord: (
    note: UserNoteRecord,
    initialData: RecoverableWordFields,
  ) => void;
  onRemoveWord: (note: UserNoteRecord) => void;
  canEdit: boolean;
  canRemove: boolean;
  onAddWord: () => void;
}

export function WordNoteList({
  notes,
  cards,
  dueCards,
  onViewNote,
  onEditWord,
  onRepairWord,
  onRemoveWord,
  canEdit,
  canRemove,
  onAddWord,
}: WordNoteListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [problemRow, setProblemRow] = useState<InvalidWordRow | null>(null);
  const cardsByNoteId = useMemo(() => {
    const result = new Map<string, Card[]>();
    for (const card of cards) {
      const noteCards = result.get(card.note_id);
      if (noteCards) noteCards.push(card);
      else result.set(card.note_id, [card]);
    }
    return result;
  }, [cards]);
  const rows = useMemo<WordListRow[]>(
    () =>
      notes.map((note) =>
        toWordListRow(note, cardsByNoteId.get(note.id) ?? EMPTY_CARDS),
      ),
    [notes, cardsByNoteId],
  );
  const filteredRows = rows.filter((row) => {
    if ('problem' in row) return searchTerm.trim() === '';
    const search = searchTerm.toLowerCase();
    return (
      row.word.toLowerCase().includes(search) ||
      row.translation.toLowerCase().includes(search)
    );
  });
  const filteredCards = filteredRows.flatMap((row) => row.cards);
  const dueCardIds = new Set(dueCards.map((card) => card.id));
  const filteredDueCount = filteredCards.filter((card) =>
    dueCardIds.has(card.id),
  ).length;
  const tableStyle: CSSProperties &
    Record<
      | '--word-column-min'
      | '--cards-column'
      | '--extra-info-column'
      | '--actions-column',
      string
    > = {
    '--word-column-min': WORD_TABLE_LAYOUT.wordColumnMinimum,
    '--cards-column': WORD_TABLE_LAYOUT.cardsColumn,
    '--extra-info-column': WORD_TABLE_LAYOUT.extraInfoColumn,
    '--actions-column': WORD_TABLE_LAYOUT.actionsColumn,
  };
  return (
    <UICard className="border border-border/60">
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex flex-nowrap items-center gap-x-4 text-base font-bold whitespace-nowrap">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <Library className="size-4 text-primary" />
            {filteredRows.length} Words
          </CardTitle>
          <span>{filteredCards.length} Cards</span>
          <span>{filteredDueCount} Cards Due</span>
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
            <div role="table" aria-label="Word Catalog" style={tableStyle}>
              <div role="rowgroup">
                <div
                  role="row"
                  className="sr-only @[880px]:not-sr-only @[880px]:grid @[880px]:grid-cols-[minmax(var(--word-column-min),1fr)_minmax(var(--word-column-min),1fr)_var(--cards-column)_var(--extra-info-column)_var(--actions-column)] gap-4 @[880px]:!px-6 @[880px]:!py-3 border-b border-border/40 bg-muted/20 text-xs font-semibold text-muted-foreground"
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
                    className="grid grid-cols-1 items-center @[880px]:grid-cols-[minmax(var(--word-column-min),1fr)_minmax(var(--word-column-min),1fr)_var(--cards-column)_var(--extra-info-column)_var(--actions-column)] gap-3 @[880px]:gap-4 px-6 py-4 border-b border-border/30 hover:bg-muted/10 transition-colors last:border-0"
                  >
                    {'problem' in row ? (
                      <div
                        role="cell"
                        className="col-span-full rounded-lg border border-amber-500/40 bg-amber-500/5"
                      >
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 px-3 py-3 text-left text-amber-900 dark:text-amber-200"
                          onClick={() => setProblemRow(row)}
                        >
                          <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                          <span className="text-sm font-medium">
                            {row.problem === 'recoverable'
                              ? 'Word data needs repair'
                              : 'Word data cannot be read'}
                          </span>
                        </button>
                      </div>
                    ) : (
                      <>
                        <div
                          role="cell"
                          className="min-w-0 truncate font-medium"
                          title={row.word}
                        >
                          <button
                            type="button"
                            className="max-w-full cursor-pointer truncate text-left hover:text-primary"
                            onClick={() => onViewNote(row.note)}
                            title="View Word"
                          >
                            {row.word}
                          </button>
                        </div>
                        <div
                          role="cell"
                          className="text-muted-foreground min-w-0 truncate"
                          title={row.translation}
                        >
                          {row.translation}
                        </div>
                        <div className="grid grid-cols-[minmax(max-content,1fr)_minmax(max-content,1fr)_minmax(max-content,1fr)] items-center gap-3 @[880px]:contents">
                          <div
                            role="cell"
                            className="flex min-w-0 items-center @[880px]:justify-self-center"
                            aria-label={`${row.cards.length} cards`}
                          >
                            <span className="text-left text-xs text-muted-foreground">
                              <span className="@[880px]:hidden">
                                Cards: {row.cards.length}
                              </span>
                              <span className="hidden @[880px]:inline">
                                {row.cards.length}
                              </span>
                            </span>
                          </div>
                          <div className="contents">
                            <div
                              role="cell"
                              className="flex min-w-0 items-center justify-center @[880px]:justify-self-center"
                            >
                              <span className="text-left text-xs text-muted-foreground">
                                <span className="@[880px]:hidden">
                                  Extra info: {row.detailsCount}
                                </span>
                                <span className="hidden @[880px]:inline">
                                  {row.detailsCount}
                                </span>
                              </span>
                            </div>
                            <div
                              role="cell"
                              className="flex min-w-0 items-center justify-end @[880px]:justify-center"
                            >
                              <div className="flex items-center gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground"
                                  onClick={() => onViewNote(row.note)}
                                  title="View Word"
                                >
                                  <Eye className="size-3.5" />
                                </Button>
                                {canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground"
                                    onClick={() => onEditWord(row.note)}
                                    title="Edit Word"
                                  >
                                    <Edit className="size-3.5" />
                                  </Button>
                                )}
                                {canRemove && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 rounded-lg cursor-pointer text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => onRemoveWord(row.note)}
                                    title="Remove word from this deck"
                                  >
                                    <Unlink className="size-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
      {problemRow && (
        <WordNoteDialog
          label={
            problemRow.problem === 'recoverable'
              ? 'Word data needs repair'
              : 'Word data cannot be read'
          }
          onClose={() => setProblemRow(null)}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-amber-800 dark:text-amber-300">
              <AlertCircle className="size-5" />
              {problemRow.problem === 'recoverable'
                ? 'Word data needs repair'
                : 'Word data cannot be read'}
            </CardTitle>
            {problemRow.problem === 'recoverable' && (
              <p className="text-sm text-muted-foreground">
                Some saved fields are missing or invalid.
              </p>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap justify-end gap-2">
              {problemRow.problem === 'recoverable' && (
                <Button
                  onClick={() => {
                    onRepairWord(problemRow.note, problemRow.initialData ?? {});
                    setProblemRow(null);
                  }}
                >
                  Repair word
                </Button>
              )}
              <Button variant="outline" onClick={() => setProblemRow(null)}>
                Leave word
              </Button>
              {canRemove && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    onRemoveWord(problemRow.note);
                    setProblemRow(null);
                  }}
                >
                  Remove word
                </Button>
              )}
            </div>
          </CardContent>
        </WordNoteDialog>
      )}
    </UICard>
  );
}
