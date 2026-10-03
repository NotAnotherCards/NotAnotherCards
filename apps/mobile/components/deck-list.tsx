import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  View,
  useWindowDimensions,
} from 'react-native';
import type { DatabaseManager } from '@remelondb/core';
import { deckKindShort } from '@repo/offline-db';
import { deckTypeAccessibilityLabel } from '@repo/i18n';
import { useTranslation } from 'react-i18next';
import { useSessionDatabase } from '@/lib/database-provider';
import { useDecks, type Deck } from '@/lib/decks';
import { toWriteError, writeErrorText, type WriteError } from '@/lib/errors';
import { Button } from './ui/button';
import {
  BookOpenIcon,
  FolderOpenIcon,
  SquarePenIcon,
  TrashIcon,
} from './ui/icon';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Text } from './ui/text';
import { DeckForm } from './deck-form';

// The manager arrives from an effect after sign-in; until then there is no
// database to query, so render the readiness state instead of a hook that
// would throw (see the note on #68).
export function DeckList({
  createRequestKey = 0,
}: {
  // The library's plus sits in its section row; each new key opens the form.
  createRequestKey?: number;
} = {}) {
  const { manager } = useSessionDatabase();
  if (!manager) {
    return (
      <View className="items-center py-6">
        <ActivityIndicator />
      </View>
    );
  }
  return (
    <ActiveDeckList manager={manager} createRequestKey={createRequestKey} />
  );
}

// One action at a time. A union rather than three booleans, so a create
// cannot overlap an edit, and the pending delete has one owner.
type DeckAction =
  | { kind: 'create' }
  | { kind: 'edit'; deck: Deck }
  | { kind: 'delete'; deck: Deck };

function ActiveDeckList({
  manager,
  createRequestKey,
}: {
  manager: DatabaseManager;
  createRequestKey: number;
}) {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { fontScale, width } = useWindowDimensions();
  const { decks, isLoading, error, cardCount, dueCount, profile, writes } =
    useDecks(manager);
  const [action, setAction] = useState<DeckAction | null>(null);
  const [writeError, setWriteError] = useState<WriteError | null>(null);
  const [pending, setPending] = useState(false);

  // Every open and cancel goes through here, so an error never outlives the
  // action that produced it or leaks into the next one.
  const open = useCallback(
    (next: DeckAction | null) => {
      // A write in flight owns this state: its completion or failure decides
      // what shows next, so another deck's action cannot start or cancel it.
      if (pending) return;
      setWriteError(null);
      setPending(false);
      setAction(next);
    },
    [pending],
  );
  // The plus in the library's section row asks for the create form, through
  // the same door as every other action: during a write it is dropped.
  const handledCreateKey = useRef(0);
  useEffect(() => {
    if (createRequestKey === handledCreateKey.current) return;
    handledCreateKey.current = createRequestKey;
    if (createRequestKey > 0) open({ kind: 'create' });
  }, [createRequestKey, open]);

  // A form closes only once its write landed, so a failed write is never
  // shown as a success (same rule as web's DeckList).
  const run = async <T,>(write: () => Promise<T>) => {
    setWriteError(null);
    setPending(true);
    try {
      await write();
      open(null);
    } catch (err) {
      setWriteError(toWriteError(err, 'mobile.messages.write_failed'));
      setPending(false);
    }
  };

  if (isLoading || !writes) {
    return (
      <View className="items-center py-6">
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <Text className="text-destructive">
        {t('mobile.messages.decks_load_failed', { message: error.message })}
      </Text>
    );
  }

  if (action?.kind === 'create') {
    return (
      <DeckForm
        title={t('mobile.messages.new_deck')}
        showNoteType
        defaultLanguages={{
          nativeLanguageId: profile?.native_language_id ?? null,
          targetLanguageId: profile?.target_language_id ?? null,
        }}
        error={writeError ? writeErrorText(writeError, t) : null}
        onSubmit={(values) =>
          run(() =>
            writes.create(values.title, values.description, {
              noteType: values.noteType,
              nativeLanguageId:
                values.noteType === 'word' ? values.nativeLanguageId : null,
              targetLanguageId:
                values.noteType === 'word' ? values.targetLanguageId : null,
            }),
          )
        }
        onCancel={() => open(null)}
      />
    );
  }

  if (action?.kind === 'edit') {
    const { deck } = action;
    return (
      <DeckForm
        title={t('mobile.messages.edit_deck')}
        initialValues={{
          title: deck.title,
          description: deck.description ?? '',
        }}
        error={writeError ? writeErrorText(writeError, t) : null}
        onSubmit={(values) =>
          run(() => writes.update(deck.id, values.title, values.description))
        }
        onCancel={() => open(null)}
      />
    );
  }

  return (
    <View className="gap-3">
      {decks.length === 0 && (
        <Text className="text-muted-foreground">
          {t('mobile.messages.no_decks')}
        </Text>
      )}
      <View role="list" className="gap-3">
        {decks.map((deck) => {
          const kindLabel = deckTypeAccessibilityLabel(
            deck,
            i18n.resolvedLanguage ?? i18n.language,
            (key, options) => t(`deck.type.${key}`, options),
          );
          return (
            <Card key={deck.id} role="listitem">
              {/* The header opens the deck. Edit and delete sit in its row as
              on web's card: pencil and trash, ghost icons, 48 touch targets.
              They are beside the opening press target, not inside it, so a
              screen reader reaches each of the three on its own. */}
              <CardHeader>
                {/* One row: the kind (named as web names it, the language
                  pair for a word deck), the name, and the two icons. */}
                <View className="flex-row items-center gap-2">
                  <Pressable
                    className="flex-1 flex-row items-center gap-2"
                    accessibilityRole="button"
                    accessibilityLabel={t('mobile.messages.open_deck', {
                      title: deck.title,
                    })}
                    onPress={() => router.push(`/deck/${deck.id}`)}
                  >
                    <Text
                      accessibilityLabel={kindLabel}
                      className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                    >
                      {deck.note_type === 'basic'
                        ? t('deck.words.col_cards')
                        : deckKindShort(deck)}
                    </Text>
                    <CardTitle className="flex-1" numberOfLines={1}>
                      {deck.title}
                    </CardTitle>
                    {deck.visibility === 'public' && (
                      <Text
                        accessibilityLabel={t(
                          'mobile.messages.published_community',
                        )}
                        className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground"
                      >
                        {t('mobile.messages.published')}
                      </Text>
                    )}
                  </Pressable>
                  {/* The glyphs sit inside 48 boxes; pulled right so the
                      trash lines up with the content's edge, as on web. */}
                  <View className="-mr-4 flex-row">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-12 w-12 sm:h-12 sm:w-12"
                      disabled={pending}
                      accessibilityLabel={t('mobile.messages.edit_item', {
                        title: deck.title,
                      })}
                      onPress={() => open({ kind: 'edit', deck })}
                    >
                      <SquarePenIcon
                        size={20}
                        className="text-muted-foreground"
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-12 w-12 sm:h-12 sm:w-12"
                      disabled={pending}
                      accessibilityLabel={t(
                        'mobile.messages.delete_deck_label',
                        { title: deck.title },
                      )}
                      onPress={() => open({ kind: 'delete', deck })}
                    >
                      <TrashIcon size={20} className="text-muted-foreground" />
                    </Button>
                  </View>
                </View>
                {/* The rest of the header opens the deck on a tap too. It is
                  no second target for a screen reader, which has the one
                  above. */}
                <Pressable
                  accessible={false}
                  className="gap-1.5"
                  onPress={() => router.push(`/deck/${deck.id}`)}
                >
                  {deck.description ? (
                    <CardDescription numberOfLines={2}>
                      {deck.description}
                    </CardDescription>
                  ) : null}
                  {/* Web's two figures side by side, same wording. A deck with
                    work reads at a glance; zero stays quiet. */}
                  <View className="mt-1 flex-row rounded-2xl border border-border px-3 py-2">
                    <View className="flex-1 items-center">
                      <Text className="text-xs font-medium text-muted-foreground">
                        {t('deck.card.total_cards')}
                      </Text>
                      <Text className="text-sm font-bold">
                        {cardCount(deck.id)}
                      </Text>
                    </View>
                    <View className="w-px bg-border" />
                    <View className="flex-1 items-center">
                      <Text className="text-xs font-medium text-muted-foreground">
                        {t('deck.card.due_short')}
                      </Text>
                      <Text
                        testID={`deck-due-${deck.id}`}
                        className={
                          dueCount(deck.id) > 0
                            ? 'text-sm font-bold text-primary'
                            : 'text-sm font-bold text-muted-foreground'
                        }
                      >
                        {dueCount(deck.id)}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </CardHeader>
              <CardContent>
                {action?.kind === 'delete' && action.deck.id === deck.id ? (
                  <View className="gap-2">
                    <Text className="text-sm">
                      {t('mobile.messages.delete_deck_help')}
                    </Text>
                    {writeError && (
                      <Text className="text-destructive">
                        {writeErrorText(writeError, t)}
                      </Text>
                    )}
                    <View className="flex-row gap-2">
                      <Button
                        variant="secondary"
                        className="h-12 flex-1 sm:h-12"
                        onPress={() => open(null)}
                        disabled={pending}
                      >
                        <Text>{t('common.cancel')}</Text>
                      </Button>
                      <Button
                        variant="destructive"
                        className="h-12 flex-1 sm:h-12"
                        loading={pending}
                        onPress={() => run(() => writes.remove(deck.id))}
                      >
                        <Text>{t('deck.form.delete_title')}</Text>
                      </Button>
                    </View>
                  </View>
                ) : (
                  <View
                    className={
                      fontScale > 1.1 || width < 360
                        ? 'gap-2'
                        : 'flex-row items-center gap-2'
                    }
                  >
                    {/* Web's two row actions, half the row each: Manage Cards
                      with web's folder, then the outline review button with
                      its icon. Short labels and compact padding fit a
                      360dp screen without splitting words.
                      Nothing due, nothing to start. */}
                    <Button
                      className="h-auto min-h-12 flex-1 gap-1 px-2 py-2 sm:h-auto"
                      disabled={pending}
                      accessibilityLabel={t('mobile.manage_deck', {
                        title: deck.title,
                      })}
                      onPress={() => router.push(`/deck/${deck.id}`)}
                    >
                      <FolderOpenIcon
                        size={16}
                        className="text-primary-foreground"
                      />
                      <Text className="shrink text-center" numberOfLines={1}>
                        {t('deck.card.actions.manage_cards_short')}
                      </Text>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto min-h-12 flex-1 gap-1 px-2 py-2 sm:h-auto"
                      disabled={pending}
                      accessibilityLabel={t('mobile.review_deck', {
                        title: deck.title,
                      })}
                      onPress={() => router.push(`/review/${deck.id}`)}
                    >
                      <BookOpenIcon size={16} className="text-foreground" />
                      <Text className="shrink text-center" numberOfLines={1}>
                        {t('deck.card.actions.start_review_short')}
                      </Text>
                    </Button>
                  </View>
                )}
              </CardContent>
            </Card>
          );
        })}
      </View>
    </View>
  );
}
