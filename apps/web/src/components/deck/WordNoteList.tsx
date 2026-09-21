import { useMemo, useState } from 'react';
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
import {
  EXAMPLE_TO_TRANSLATION_TEMPLATE_KEY,
  TRANSLATION_TO_WORD_TEMPLATE_KEY,
  WORD_TO_TRANSLATION_TEMPLATE_KEY,
  WordNoteFieldsV1,
  type UserNoteRecord,
} from '@repo/offline-db';
import { languageFor } from '@repo/schemas';

interface WordNoteListProps {
  notes: UserNoteRecord[];
  cards: Card[];
  onViewNote: (card: Card) => void;
  onViewDetails: (note: UserNoteRecord) => void;
  onEditWord: (card: Card) => void;
  onRemoveWord: (card: Card) => void;
  canEdit: boolean;
  canRemove: boolean;
  onAddWord: () => void;
}

type WordCardBadge = 'Word' | 'Translation' | 'Example' | 'Audio';

interface WordRow {
  readonly note: UserNoteRecord;
  readonly word: string;
  readonly translation: string;
  readonly cards: Card[];
  readonly detailsCount: number;
  readonly badges: string[];
  readonly actionCard: Card | null;
}

const badgeForTemplateKey: Readonly<Record<string, WordCardBadge>> = {
  [WORD_TO_TRANSLATION_TEMPLATE_KEY]: 'Word',
  [TRANSLATION_TO_WORD_TEMPLATE_KEY]: 'Translation',
  [EXAMPLE_TO_TRANSLATION_TEMPLATE_KEY]: 'Example',
  audio: 'Audio',
  listen: 'Audio',
};

const badgeOrder: readonly WordCardBadge[] = [
  'Word',
  'Translation',
  'Example',
  'Audio',
];

const languageCodeForName: Readonly<Record<string, string>> = {
  English: 'EN',
  Spanish: 'ES',
  German: 'DE',
  Russian: 'RU',
};

function languageCode(languageId: string): string {
  const language = languageFor(languageId);
  return language ? (languageCodeForName[language.name] ?? '??') : '??';
}

function badgeLabel(
  badge: WordCardBadge,
  nativeLanguageId: string,
  targetLanguageId: string,
): string {
  const native = languageCode(nativeLanguageId);
  const target = languageCode(targetLanguageId);

  switch (badge) {
    case 'Word':
      return `${target} → ${native}`;
    case 'Translation':
      return `${native} → ${target}`;
    case 'Example':
      return `Example → ${target}`;
    case 'Audio':
      return 'Audio';
  }
}

function countDetails(fields: Record<string, string | undefined>): number {
  const hasExample =
    fields.example !== undefined || fields.example_translation !== undefined;
  const detailKeys = [
    'part_of_speech',
    'gender',
    'pronunciation',
    'notes',
    'image',
    'word_audio',
  ] as const;

  return (
    Number(hasExample) +
    detailKeys.filter((key) => fields[key] !== undefined).length
  );
}

function toWordRow(note: UserNoteRecord, cards: Card[]): WordRow | null {
  try {
    const parsed = WordNoteFieldsV1.safeParse(JSON.parse(note.fields_json));
    if (!parsed.success) return null;

    const fields = parsed.data;
    const noteCards = cards.filter((card) => card.note_id === note.id);
    const existingBadges = new Set(
      noteCards.flatMap((card) => {
        const badge = badgeForTemplateKey[card.template_key];
        return badge ? [badge] : [];
      }),
    );
    const badges = badgeOrder
      .filter((badge) => existingBadges.has(badge))
      .map((badge) =>
        badgeLabel(
          badge,
          fields.native_language_id,
          fields.target_language_id,
        ),
      );
    const actionCard =
      noteCards.find(
        (card) => card.template_key === WORD_TO_TRANSLATION_TEMPLATE_KEY,
      ) ?? noteCards[0] ?? null;

    return {
      note,
      word: fields.word,
      translation: fields.translation,
      cards: noteCards,
      badges,
      actionCard,
      detailsCount: countDetails(fields),
    };
  } catch {
    return null;
  }
}

export function WordNoteList({
  notes,
  cards,
  onViewNote,
  onViewDetails,
  onEditWord,
  onRemoveWord,
  canEdit,
  canRemove,
  onAddWord,
}: WordNoteListProps) {
  const [searchTerm, setSearchTerm] = useState('');
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

  return (
    <UICard className="border border-border/60">
      <CardHeader className="border-b border-border/40 pb-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Library className="size-4 text-primary" />
          {filteredRows.length} Words
        </CardTitle>
        <div className="relative w-full md:max-w-xs">
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
          <div role="table" aria-label="Word Catalog">
            <div role="rowgroup">
              <div
                role="row"
                className="sr-only xl:not-sr-only xl:grid xl:grid-cols-[minmax(110px,1fr)_minmax(110px,1fr)_466px_76px_108px] gap-4 xl:!px-6 xl:!py-3 border-b border-border/40 bg-muted/20 text-xs font-semibold text-muted-foreground"
              >
                <div role="columnheader">Word</div>
                <div role="columnheader">Translation</div>
                <div role="columnheader">Cards</div>
                <div role="columnheader">Details</div>
                <div role="columnheader" className="text-center">Actions</div>
              </div>
            </div>
            <div role="rowgroup">
              {filteredRows.map((row, index) => (
                <div
                  key={row.note.id}
                  role="row"
                  aria-rowindex={index + 2}
                  className="grid grid-cols-1 md:grid-cols-6 xl:grid-cols-[minmax(110px,1fr)_minmax(110px,1fr)_466px_76px_108px] gap-3 xl:gap-4 px-6 py-4 border-b border-border/30 hover:bg-muted/10 transition-colors last:border-0"
                >
                  <div role="cell" className="font-medium min-w-0 truncate md:col-span-3 xl:col-auto" title={row.word}>
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
                  <div role="cell" className="text-muted-foreground min-w-0 truncate md:col-span-3 xl:col-auto" title={row.translation}>
                    {row.translation}
                  </div>
                  <div role="cell" className="grid grid-cols-[repeat(2,7rem)] gap-1.5 min-[850px]:flex min-[850px]:flex-nowrap md:col-span-4 xl:col-auto" aria-label={`${row.cards.length} cards`}>
                    {row.badges.map((badge) => (
                      <span
                        key={badge}
                        className="inline-flex h-7 w-28 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/35 px-2 text-xs font-medium text-muted-foreground"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                  <div role="cell" className="flex items-center gap-1.5 md:col-span-2 md:justify-end xl:contents">
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-primary cursor-pointer xl:self-center"
                      onClick={() => onViewDetails(row.note)}
                      aria-label={`View ${row.detailsCount} details`}
                    >
                      {row.detailsCount} details
                    </button>
                    <div role="cell" className="flex items-center gap-1.5 xl:justify-center">
                      {row.actionCard && (
                        <Button variant="ghost" size="icon" className="size-7 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => onViewNote(row.actionCard!)} title="View Note">
                          <Eye className="size-3.5" />
                        </Button>
                      )}
                      {canEdit && row.actionCard && (
                        <Button variant="ghost" size="icon" className="size-7 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => onEditWord(row.actionCard!)} title="Edit Note">
                          <Edit className="size-3.5" />
                        </Button>
                      )}
                      {canRemove && row.actionCard && (
                        <Button variant="ghost" size="icon" className="size-7 rounded-lg cursor-pointer text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => onRemoveWord(row.actionCard!)} title="Remove Word">
                          <Unlink className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </UICard>
  );
}
