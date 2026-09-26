import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';
import type { DatabaseManager } from '@remelondb/core';
import { deckKind, deckKindShort } from '@repo/offline-db';
import { useSessionDatabase } from '@/lib/database-provider';
import { useDecks, type Deck } from '@/lib/decks';
import { writeErrorMessage } from '@/lib/errors';
import { Button } from './ui/button';
import {
  BookOpenIcon,
  FolderOpenIcon,
  PlusIcon,
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
        {/* Web's Create Deck: the plus and the label at the default height.
            The row buttons below are 48 high, Android's touch target size. */}
        <Button
          className="gap-1.5"
          disabled={pending}
          onPress={() => open({ kind: 'create' })}
        >
          <PlusIcon size={16} className="text-primary-foreground" />
          <Text>Create deck</Text>
        </Button>
      </View>
      {decks.length === 0 && (
        <Text className="text-muted-foreground">
          No decks yet. Create your first one.
        </Text>
      )}
      <View role="list" className="gap-3">
        {decks.map((deck) => {
          return (
            <Card key={deck.id} role="listitem">
              {/* The header opens the deck. Edit and delete sit in its row as
              on web's card: pencil and trash, ghost icons, 48 touch targets. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${deck.title}`}
                onPress={() => router.push(`/deck/${deck.id}`)}
              >
                <CardHeader>
                  {/* One row: the kind (named as web names it, the language
                    pair for a word deck), the name, and the two icons. */}
                  <View className="flex-row items-center gap-2">
                    <Text
                      accessibilityLabel={deckKind(deck)}
                      className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                    >
                      {deckKindShort(deck)}
                    </Text>
                    <CardTitle className="flex-1" numberOfLines={1}>
                      {deck.title}
                    </CardTitle>
                    {/* The glyphs sit inside 48 boxes; pulled right so the
                      trash lines up with the content's edge, as on web. */}
                    <View className="-mr-4 flex-row">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-12 w-12 sm:h-12 sm:w-12"
                        disabled={pending}
                        accessibilityLabel={`Edit ${deck.title}`}
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
                        accessibilityLabel={`Delete ${deck.title}`}
                        onPress={() => open({ kind: 'delete', deck })}
                      >
                        <TrashIcon
                          size={20}
                          className="text-muted-foreground"
                        />
                      </Button>
                    </View>
                  </View>
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
                        className="h-12 flex-1 sm:h-12"
                        onPress={() => open(null)}
                        disabled={pending}
                      >
                        <Text>Cancel</Text>
                      </Button>
                      <Button
                        variant="destructive"
                        className="h-12 flex-1 sm:h-12"
                        loading={pending}
                        onPress={() => run(() => writes.remove(deck.id))}
                      >
                        <Text>Delete deck</Text>
                      </Button>
                    </View>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-2">
                    {/* Web's two row actions, half the row each: Manage Cards
                      with web's folder, then the outline review button with
                      its icon. At least 48 high; a longer label in
                      another language wraps instead of being cut off.
                      Nothing due, nothing to start. */}
                    <Button
                      className="h-auto min-h-12 flex-1 gap-1.5 py-2 sm:h-auto"
                      disabled={pending}
                      accessibilityLabel={`Manage cards of ${deck.title}`}
                      onPress={() => router.push(`/deck/${deck.id}`)}
                    >
                      <FolderOpenIcon
                        size={16}
                        className="text-primary-foreground"
                      />
                      <Text className="shrink text-center">Manage cards</Text>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto min-h-12 flex-1 py-2 sm:h-auto"
                      disabled={pending || dueCount(deck.id) === 0}
                      accessibilityLabel={`Start review of ${deck.title}`}
                      onPress={() => router.push(`/review/${deck.id}`)}
                    >
                      <BookOpenIcon size={16} className="text-foreground" />
                      <Text className="shrink text-center">Start Review</Text>
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
