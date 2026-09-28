import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';
import type { DatabaseManager } from '@remelondb/core';
import { deckKind, deckKindShort } from '@repo/offline-db';
import { useSessionDatabase } from '@/lib/database-provider';
import { useDecks, type Deck } from '@/lib/decks';
import { writeErrorMessage } from '@/lib/errors';
import { Button } from './ui/button';
import { BookOpenIcon } from './ui/icon';
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
export function DeckList() {
  const { manager } = useSessionDatabase();
  if (!manager) {
    return (
      <View className="items-center py-6">
        <ActivityIndicator />
      </View>
    );
  }
  return <ActiveDeckList manager={manager} />;
}

// One action at a time. A union rather than three booleans, so a create
// cannot overlap an edit, and the pending delete has one owner.
type DeckAction =
  | { kind: 'create' }
  | { kind: 'edit'; deck: Deck }
  | { kind: 'delete'; deck: Deck };

function ActiveDeckList({ manager }: { manager: DatabaseManager }) {
  const router = useRouter();
  const { decks, isLoading, error, cardCount, dueCount, profile, writes } =
    useDecks(manager);
  const [action, setAction] = useState<DeckAction | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Every open and cancel goes through here, so an error never outlives the
  // action that produced it or leaks into the next one.
  const open = (next: DeckAction | null) => {
    // A write in flight owns this state: its completion or failure decides
    // what shows next, so another deck's action cannot start or cancel it.
    if (pending) return;
    setWriteError(null);
    setPending(false);
    setAction(next);
  };

  // A form closes only once its write landed, so a failed write is never
  // shown as a success (same rule as web's DeckList).
  const run = async (write: () => Promise<unknown>) => {
    setWriteError(null);
    setPending(true);
    try {
      await write();
      open(null);
    } catch (err) {
      setWriteError(writeErrorMessage(err, 'The write failed'));
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
        Failed to load decks: {error.message}
      </Text>
    );
  }

  if (action?.kind === 'create') {
    return (
      <DeckForm
        title="New deck"
        showNoteType
        defaultLanguages={{
          nativeLanguageId: profile?.native_language_id ?? null,
          targetLanguageId: profile?.target_language_id ?? null,
        }}
        error={writeError}
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
        title="Edit deck"
        initialValues={{
          title: deck.title,
          description: deck.description ?? '',
        }}
        error={writeError}
        onSubmit={(values) =>
          run(() => writes.update(deck.id, values.title, values.description))
        }
        onCancel={() => open(null)}
      />
    );
  }

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold">My decks</Text>
        <Button disabled={pending} onPress={() => open({ kind: 'create' })}>
          <Text>New deck</Text>
        </Button>
      </View>
      {decks.length === 0 && (
        <Text className="text-muted-foreground">
          No decks yet. Create your first one.
        </Text>
      )}
      <View role="list" className="gap-3">
        {decks.map((deck) => {
          // A short description rides on the title's row; a long one would
          // squeeze the name, so it drops to its own line. Character count
          // rather than measurement: a hint, not a guarantee.
          const inlineDescription =
            !!deck.description && deck.description.length <= 24;
          return (
            <Card key={deck.id} role="listitem">
              {/* The header opens the deck; edit and delete stay below it, so
              the two targets never overlap. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${deck.title}`}
                onPress={() => router.push(`/deck/${deck.id}`)}
              >
                <CardHeader>
                  {/* One row: the kind (named as web names it, the language
                    pair for a word deck), the name, and the description on
                    the right. Each keeps to one line. */}
                  <View className="flex-row items-center justify-between gap-2">
                    <Text
                      accessibilityLabel={deckKind(deck)}
                      className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                    >
                      {deckKindShort(deck)}
                    </Text>
                    <CardTitle className="flex-1 text-center" numberOfLines={1}>
                      {deck.title}
                    </CardTitle>
                    {inlineDescription ? (
                      <CardDescription
                        className="max-w-[40%] shrink text-right"
                        numberOfLines={1}
                      >
                        {deck.description}
                      </CardDescription>
                    ) : null}
                  </View>
                  {deck.description && !inlineDescription ? (
                    <CardDescription numberOfLines={2}>
                      {deck.description}
                    </CardDescription>
                  ) : null}
                  {/* Web's two figures side by side, same wording. A deck with
                    work reads at a glance; zero stays quiet. */}
                  <View className="mt-1 flex-row rounded-2xl border border-border px-3 py-2">
                    <View className="flex-1 items-center">
                      <Text className="text-xs font-medium text-muted-foreground">
                        Total Cards
                      </Text>
                      <Text className="text-sm font-bold">
                        {cardCount(deck.id)}
                      </Text>
                    </View>
                    <View className="w-px bg-border" />
                    <View className="flex-1 items-center">
                      <Text className="text-xs font-medium text-muted-foreground">
                        Due
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
                </CardHeader>
              </Pressable>
              <CardContent>
                {action?.kind === 'delete' && action.deck.id === deck.id ? (
                  <View className="gap-2">
                    <Text className="text-sm">
                      Delete this deck? Its cards are kept and stay in review.
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
                        <Text>Cancel</Text>
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        loading={pending}
                        onPress={() => run(() => writes.remove(deck.id))}
                      >
                        <Text>Delete deck</Text>
                      </Button>
                    </View>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-2">
                    {/* Web's outline review button with the same icon, sharing
                      the row with the two deck actions. Nothing due, nothing
                      to start. */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-[2]"
                      disabled={pending || dueCount(deck.id) === 0}
                      accessibilityLabel={`Start review of ${deck.title}`}
                      onPress={() => router.push(`/review/${deck.id}`)}
                    >
                      <BookOpenIcon size={14} className="text-foreground" />
                      <Text>Start Review</Text>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={pending}
                      accessibilityLabel={`Edit ${deck.title}`}
                      onPress={() => open({ kind: 'edit', deck })}
                    >
                      <Text className="text-primary">Edit</Text>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={pending}
                      accessibilityLabel={`Delete ${deck.title}`}
                      onPress={() => open({ kind: 'delete', deck })}
                    >
                      <Text className="text-destructive">Delete</Text>
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
