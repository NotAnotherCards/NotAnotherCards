import { useMemo, useState, type CSSProperties } from 'react';
import type { Card } from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card as UICard, CardContent, CardHeader } from '@/components/ui/card';
import {
  AlertCircle,
  Edit,
  Eye,
  HelpCircle,
  Search,
  Trash2,
  Unlink,
} from 'lucide-react';
import { type UserNoteRecord } from '@repo/offline-db';
import { toWordListRow, type WordListRow } from './word-note-rows';
import { DeckStat } from './DeckStat';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';
import { useTranslation } from 'react-i18next';

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
  activeWordCount?: number;
  wordCount?: number;
  totalCardCount?: number;
  dueCardCount?: number;
  onViewNote: (note: UserNoteRecord) => void;
  onEditWord: (note: UserNoteRecord) => void;
  onRemoveWord: (note: UserNoteRecord) => void;
  canEdit: boolean;
  canRemove: boolean;
  onAddWord: () => void;
  basicCards?: Card[];
  onViewCard?: (card: Card) => void;
  onEditCard?: (card: Card) => void;
  onRemoveCard?: (card: Card) => void;
  searchPlaceholder?: string;
  firstColumnLabel?: string;
  secondColumnLabel?: string;
  canAddWord?: boolean;
  removeWordTitle?: string;
  removeWordLabel?: string;
  removeWordIcon?: 'unlink' | 'delete';
  removeInvalidNoteTitle?: string;
  removeInvalidNoteLabel?: string;
}

export function WordNoteList({
  notes,
  cards,
  activeWordCount = 0,
  wordCount = notes.length,
  totalCardCount = cards.length,
  dueCardCount = 0,
  onViewNote,
  onEditWord,
  onRemoveWord,
  canEdit,
  canRemove,
  onAddWord,
  basicCards = [],
  onViewCard,
  onEditCard,
  onRemoveCard,
  searchPlaceholder,
  firstColumnLabel,
  secondColumnLabel,
  canAddWord = true,
  removeWordTitle,
  removeWordLabel,
  removeWordIcon = 'unlink',
  removeInvalidNoteTitle,
  removeInvalidNoteLabel,
}: WordNoteListProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
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
    if (!('fields' in row)) return searchTerm.trim() === '';
    const search = searchTerm.toLowerCase();
    return (
      row.word.toLowerCase().includes(search) ||
      row.translation.toLowerCase().includes(search)
    );
  });
  const filteredBasicCards = basicCards.filter((card) => {
    const search = searchTerm.toLowerCase();
    return (
      card.front.toLowerCase().includes(search) ||
      card.back.toLowerCase().includes(search)
    );
  });
  const hasResults = filteredRows.length + filteredBasicCards.length > 0;
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
      <CardHeader className="@container border-b border-border/40 pb-4">
        <div className="grid grid-cols-2 gap-2 @[720px]:grid-cols-4">
          <DeckStat
            label={t('deck.stats.words_total', 'Words Total')}
            value={wordCount}
          />
          <DeckStat
            label={t('deck.stats.active_words', 'Active Words')}
            value={activeWordCount}
          />
          <DeckStat
            label={t('deck.stats.cards', 'Cards')}
            value={totalCardCount}
          />
          <DeckStat
            label={t('deck.stats.cards_due', 'Cards Due')}
            value={dueCardCount}
          />
        </div>
        <div className="relative mt-4 w-full md:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder={
              searchPlaceholder ??
              t('deck.words.search_placeholder', 'Search word, translation...')
            }
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!hasResults ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground min-h-50 gap-4">
            <HelpCircle className="size-10 mb-2 stroke-1 opacity-60" />
            <p className="text-sm font-semibold">
              {t('deck.words.no_found', 'No Words Found')}
            </p>
            <p className="text-xs max-w-xs mt-1">
              {searchTerm
                ? t(
                    'deck.words.refine_search',
                    'Try refining your search term to find a word in this deck.',
                  )
                : t(
                    'deck.words.empty_deck',
                    'This deck is empty. Click Add Word above to start building your collection.',
                  )}
            </p>
            {!searchTerm &&
              notes.length === 0 &&
              basicCards.length === 0 &&
              canAddWord && (
                <Button onClick={onAddWord} className="cursor-pointer">
                  {t('deck.detail.add_word', 'Add Word')}
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
                  <div role="columnheader">
                    {firstColumnLabel ?? t('deck.words.col_word', 'Word')}
                  </div>
                  <div role="columnheader">
                    {secondColumnLabel ??
                      t('deck.words.col_translation', 'Translation')}
                  </div>
                  <div role="columnheader" className="text-center">
                    {t('deck.words.col_cards', 'Cards')}
                  </div>
                  <div role="columnheader" className="text-center">
                    {t('deck.words.col_details', 'Details')}
                  </div>
                  <div role="columnheader" className="text-center">
                    {t('deck.words.col_actions', 'Actions')}
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
                    {!('fields' in row) ? (
                      <div
                        role="cell"
                        className="col-span-full flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-3"
                      >
                        <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span className="mr-auto text-sm font-medium text-amber-900 dark:text-amber-200">
                          {t(
                            'deck.words.cant_show',
                            "This word can't be shown",
                          )}
                        </span>
                        {canRemove && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="cursor-pointer"
                            onClick={() => onRemoveWord(row.note)}
                            title={removeInvalidNoteTitle}
                          >
                            {removeInvalidNoteLabel ??
                              removeWordLabel ??
                              t('deck.words.remove_word', 'Remove word')}
                          </Button>
                        )}
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
                            title={t('deck.words.view_word', 'View Word')}
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
                                {t(
                                  'deck.words.cards_count',
                                  'Cards: {{count}}',
                                  { count: row.cards.length },
                                )}
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
                                  {t(
                                    'deck.words.details_count',
                                    'Extra info: {{count}}',
                                    { count: row.detailsCount },
                                  )}
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
                                  title={t('deck.words.view_word', 'View Word')}
                                >
                                  <Eye className="size-3.5" />
                                </Button>
                                {canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground"
                                    onClick={() => onEditWord(row.note)}
                                    title={t(
                                      'deck.word_view.edit_word',
                                      'Edit Word',
                                    )}
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
                                    title={
                                      removeWordTitle ??
                                      t(
                                        'deck.card_item.remove',
                                        'Remove from Deck',
                                      )
                                    }
                                  >
                                    {removeWordIcon === 'delete' ? (
                                      <Trash2 className="size-3.5" />
                                    ) : (
                                      <Unlink className="size-3.5" />
                                    )}
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
                {filteredBasicCards.map((card, index) => (
                  <div
                    key={card.id}
                    role="row"
                    aria-rowindex={filteredRows.length + index + 2}
                    className="grid grid-cols-1 items-center @[880px]:grid-cols-[minmax(var(--word-column-min),1fr)_minmax(var(--word-column-min),1fr)_var(--cards-column)_var(--extra-info-column)_var(--actions-column)] gap-3 @[880px]:gap-4 px-6 py-4 border-b border-border/30 hover:bg-muted/10 transition-colors last:border-0"
                  >
                    <div
                      role="cell"
                      className="min-w-0 overflow-hidden font-medium"
                      title={card.front}
                    >
                      <MarkdownRenderer
                        content={card.front}
                        className="line-clamp-2 [&_p]:m-0 [&_img]:max-h-12 [&_img]:max-w-full [&_audio]:max-w-full"
                      />
                    </div>
                    <div
                      role="cell"
                      className="text-muted-foreground min-w-0 overflow-hidden"
                      title={card.back}
                    >
                      <MarkdownRenderer
                        content={card.back}
                        className="line-clamp-2 [&_p]:m-0 [&_img]:max-h-12 [&_img]:max-w-full [&_audio]:max-w-full"
                      />
                    </div>
                    <div className="grid grid-cols-[minmax(max-content,1fr)_minmax(max-content,1fr)_minmax(max-content,1fr)] items-center gap-3 @[880px]:contents">
                      <div
                        role="cell"
                        className="flex min-w-0 items-center @[880px]:justify-self-center"
                      >
                        <span className="text-left text-xs text-muted-foreground">
                          <span className="@[880px]:hidden">
                            {t('deck.words.cards_count', 'Cards: {{count}}', {
                              count: 1,
                            })}
                          </span>
                          <span className="hidden @[880px]:inline">1</span>
                        </span>
                      </div>
                      <div
                        role="cell"
                        className="flex min-w-0 items-center justify-center @[880px]:justify-self-center"
                      >
                        <span className="text-left text-xs text-muted-foreground">
                          <span className="@[880px]:hidden">
                            {t(
                              'deck.words.details_count',
                              'Extra info: {{count}}',
                              { count: 0 },
                            )}
                          </span>
                          <span className="hidden @[880px]:inline">0</span>
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
                            onClick={() => onViewCard?.(card)}
                            title={t('deck.no_deck.view_card', 'View Card')}
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          {canEdit && onEditCard && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground"
                              onClick={() => onEditCard(card)}
                              title={t('deck.no_deck.edit_card', 'Edit Card')}
                            >
                              <Edit className="size-3.5" />
                            </Button>
                          )}
                          {canRemove && onRemoveCard && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 rounded-lg cursor-pointer text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => onRemoveCard(card)}
                              title={t(
                                'deck.no_deck.delete_card',
                                'Delete card',
                              )}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
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
    </UICard>
  );
}
