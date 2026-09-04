import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { DatabaseManager } from '@remelondb/core';
import { useSessionDatabase } from '@/lib/database-provider';
import { useDecks, type Deck } from '@/lib/decks';
import { writeErrorMessage } from '@/lib/errors';
import { Button } from './ui/button';
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
  const { decks, isLoading, error, cardCount, writes } = useDecks(manager);
  const [action, setAction] = useState<DeckAction | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Every open and cancel goes through here, so an error never outlives the
  // action that produced it or leaks into the next one.
  const open = (next: DeckAction | null) => {
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
        error={writeError}
        onSubmit={(values) =>
          run(() => writes.create(values.title, values.description))
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
        <Button onPress={() => open({ kind: 'create' })}>
          <Text>New deck</Text>
        </Button>
      </View>
      {decks.length === 0 && (
        <Text className="text-muted-foreground">
          No decks yet. Create your first one.
        </Text>
      )}
      {decks.map((deck) => (
        <Card key={deck.id}>
          <CardHeader>
            <CardTitle>{deck.title}</CardTitle>
            {deck.description ? (
              <CardDescription>{deck.description}</CardDescription>
            ) : null}
            <Text className="text-xs text-muted-foreground">
              {cardCount(deck.id)} cards
            </Text>
          </CardHeader>
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
              <View className="flex-row gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  accessibilityLabel={`Edit ${deck.title}`}
                  onPress={() => open({ kind: 'edit', deck })}
                >
                  <Text className="text-primary">Edit</Text>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  accessibilityLabel={`Delete ${deck.title}`}
                  onPress={() => open({ kind: 'delete', deck })}
                >
                  <Text className="text-destructive">Delete</Text>
                </Button>
              </View>
            )}
          </CardContent>
        </Card>
      ))}
    </View>
  );
}
