import { useState } from 'react';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, ScrollView, View } from 'react-native';
import type { DatabaseManager } from '@remelondb/core';
import { useSessionDatabase } from '@/lib/database-provider';
import { useCards, type Card as CardRecord } from '@/lib/cards';
import { writeErrorMessage } from '@/lib/errors';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Text } from './ui/text';
import { Markdown } from './ui/markdown';
import { CardEditor } from './card-editor';
import { PublishPanel } from './publish-panel';
import { BASIC_NOTE_TYPE, WORD_NOTE_TYPE } from '@repo/offline-db';

// Readiness gate, as DeckList: no manager yet means no database to query.
export function CardList({ deckId }: { deckId: string }) {
  const { manager } = useSessionDatabase();
  if (!manager) {
    return (
      <View className="gap-4 p-6">
        <View className="items-center py-6">
          <ActivityIndicator />
        </View>
      </View>
    );
  }
  return <ActiveCardList manager={manager} deckId={deckId} />;
}

// One action at a time, same union as DeckList. Two removal scopes, and
// the confirmation copy is what tells them apart: remove ends this deck's
// membership and keeps the note, delete takes the note everywhere.
// Accessibility labels carry the front; a 1000-character front is not a label.
const short = (text: string) =>
  text.length > 40 ? `${text.slice(0, 40)}…` : text;

type CardAction =
  | { kind: 'create' }
  | { kind: 'edit'; card: CardRecord }
  | { kind: 'remove'; card: CardRecord }
  | { kind: 'delete'; card: CardRecord };

function ActiveCardList({
  manager,
  deckId,
}: {
  manager: DatabaseManager;
  deckId: string;
}) {
  const { t } = useTranslation();
  const { deck, cards, isLoading, error, canEdit, noteForCard, writes } =
    useCards(manager, deckId);
  const [action, setAction] = useState<CardAction | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const open = (next: CardAction | null) => {
    // A write in flight owns this state: its completion or failure decides
    // what shows next, so another card's action cannot start or cancel it.
    if (pending) return;
    setWriteError(null);
    setPending(false);
    setAction(next);
  };

  const run = async <T,>(write: () => Promise<T>) => {
    setWriteError(null);
    setPending(true);
    try {
      await write();
      open(null);
    } catch (err) {
      setWriteError(writeErrorMessage(err, t('mobile.messages.write_failed')));
      setPending(false);
    }
  };

  if (isLoading || !writes) {
    return (
      <View className="gap-4 p-6">
        <View className="items-center py-6">
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View className="gap-4 p-6">
        <Text className="text-destructive">
          {t('mobile.messages.cards_load_failed', { message: error.message })}
        </Text>
      </View>
    );
  }

  if (!deck) {
    return (
      <View className="gap-4 p-6">
        <Text className="text-muted-foreground">
          {t('mobile.messages.deck_not_local')}
        </Text>
      </View>
    );
  }

  const isBasicDeck = deck.note_type === BASIC_NOTE_TYPE;
  const isWordDeck = deck.note_type === WORD_NOTE_TYPE;
  const isKnownDeck = isBasicDeck || isWordDeck;

  if (action?.kind === 'create' || action?.kind === 'edit') {
    const card = action.kind === 'edit' ? action.card : undefined;
    return (
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 p-6"
        keyboardShouldPersistTaps="handled"
      >
        <CardEditor
          deck={deck}
          card={card}
          note={card ? noteForCard(card) : null}
          writes={writes}
          onDone={() => open(null)}
        />
      </ScrollView>
    );
  }

  const confirming = (card: CardRecord) =>
    (action?.kind === 'remove' || action?.kind === 'delete') &&
    action.card.id === card.id
      ? action.kind
      : null;

  return (
    <>
      {/* The deck's title belongs in the header; the route sets a fallback. */}
      <Stack.Screen options={{ title: deck.title }} />
      <FlatList
        className="flex-1"
        contentContainerClassName="p-6"
        keyboardShouldPersistTaps="handled"
        role="list"
        data={cards}
        keyExtractor={(card) => card.id}
        initialNumToRender={12}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          <View className="gap-4 pb-3">
            <PublishPanel deck={deck} cards={cards} />
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-semibold">
                  {t('deck.words.col_cards')}
                </Text>
                {isKnownDeck && (
                  <Button
                    disabled={pending}
                    onPress={() => open({ kind: 'create' })}
                  >
                    <Text>
                      {isWordDeck
                        ? t('mobile.messages.new_word')
                        : t('mobile.messages.new_card')}
                    </Text>
                  </Button>
                )}
              </View>
              {!isKnownDeck && (
                <Text className="text-muted-foreground">
                  {t('deck.detail.unknown_note_type')}
                </Text>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text className="text-muted-foreground">
            {t('mobile.messages.no_cards')}
          </Text>
        }
        renderItem={({ item: card }) => {
          const confirm = confirming(card);
          return (
            <Card role="listitem">
              <CardHeader>
                <CardTitle>
                  <Markdown content={card.front} inline />
                </CardTitle>
                <Text className="text-sm text-muted-foreground">
                  <Markdown content={card.back} inline />
                </Text>
                {!card.active && (
                  <Text className="text-xs text-muted-foreground">
                    {t('review.activation.inactive_label')}
                  </Text>
                )}
              </CardHeader>
              <CardContent>
                {confirm ? (
                  <View className="gap-2">
                    <Text className="text-sm">
                      {confirm === 'remove'
                        ? t('mobile.messages.remove_card_help')
                        : t('mobile.messages.delete_note_help')}
                    </Text>
                    {writeError && (
                      <Text className="text-destructive">{writeError}</Text>
                    )}
                    <View className="flex-row gap-2">
                      <Button
                        variant="secondary"
                        className="flex-1"
                        onPress={() => open(null)}
                        disabled={pending}
                      >
                        <Text>{t('common.cancel')}</Text>
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        loading={pending}
                        onPress={() =>
                          run(() =>
                            confirm === 'remove'
                              ? writes.removeFromDeck(card.note_id, deckId)
                              : writes.deleteNote(card.note_id),
                          )
                        }
                      >
                        <Text>
                          {confirm === 'remove'
                            ? t('deck.detail.remove_btn')
                            : t('mobile.messages.delete_note')}
                        </Text>
                      </Button>
                    </View>
                  </View>
                ) : (
                  <View className="flex-row flex-wrap gap-2">
                    {isKnownDeck && canEdit(card) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        accessibilityLabel={t('mobile.messages.edit_item', {
                          title: short(card.front),
                        })}
                        onPress={() => open({ kind: 'edit', card })}
                      >
                        <Text className="text-primary">
                          {t('deck.card.actions.edit')}
                        </Text>
                      </Button>
                    )}
                    {isKnownDeck && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          accessibilityLabel={t('mobile.messages.remove_item', {
                            title: short(card.front),
                          })}
                          onPress={() => open({ kind: 'remove', card })}
                        >
                          <Text>{t('mobile.messages.remove')}</Text>
                        </Button>
                        {canEdit(card) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            accessibilityLabel={t(
                              'mobile.messages.delete_item',
                              { title: short(card.front) },
                            )}
                            onPress={() => open({ kind: 'delete', card })}
                          >
                            <Text className="text-destructive">
                              {t('deck.card.actions.delete')}
                            </Text>
                          </Button>
                        )}
                      </>
                    )}
                  </View>
                )}
              </CardContent>
            </Card>
          );
        }}
      />
    </>
  );
}
