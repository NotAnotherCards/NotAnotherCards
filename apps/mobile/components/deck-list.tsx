import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import type { DatabaseManager } from '@remelondb/core';
import { useSessionDatabase } from '@/lib/database-provider';
import { useDecks, type Deck } from '@/lib/decks';
import { writeErrorMessage } from '@repo/offline-db';
import { Button } from './ui/button';
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

function ActiveDeckList({ manager }: { manager: DatabaseManager }) {
  const { decks, isLoading, error, cardCount, writes } = useDecks(manager);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Deck | null>(null);
  const [deleting, setDeleting] = useState<Deck | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);

  // A form closes only once its write landed, so a failed write is never
  // shown as a success (same rule as web's DeckList).
  const run = async (write: () => Promise<unknown>, done: () => void) => {
    setWriteError(null);
    try {
      await write();
      done();
    } catch (err) {
      setWriteError(writeErrorMessage(err, 'The write failed'));
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

  if (creating) {
    return (
      <DeckForm
        title="New deck"
        error={writeError}
        onSubmit={(values) =>
          run(
            () => writes.create(values.title, values.description),
            () => setCreating(false),
          )
        }
        onCancel={() => setCreating(false)}
      />
    );
  }

  if (editing) {
    return (
      <DeckForm
        title="Edit deck"
        initialValues={{
          title: editing.title,
          description: editing.description ?? '',
        }}
        error={writeError}
        onSubmit={(values) =>
          run(
            () => writes.update(editing.id, values.title, values.description),
            () => setEditing(null),
          )
        }
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold">My decks</Text>
        <Button label="New deck" onPress={() => setCreating(true)} />
      </View>
      {writeError && <Text className="text-destructive">{writeError}</Text>}
      {decks.length === 0 && (
        <Text className="text-muted-foreground">
          No decks yet. Create your first one.
        </Text>
      )}
      {decks.map((deck) => (
        <View
          key={deck.id}
          className="gap-2 rounded-xl border border-border bg-card p-4"
        >
          <Text className="text-base font-semibold">{deck.title}</Text>
          {deck.description ? (
            <Text className="text-sm text-muted-foreground">
              {deck.description}
            </Text>
          ) : null}
          <Text className="text-xs text-muted-foreground">
            {cardCount(deck.id)} cards
          </Text>
          {deleting?.id === deck.id ? (
            <View className="gap-2">
              <Text className="text-sm">
                Delete this deck? Its cards are kept and stay in review (#212).
              </Text>
              <View className="flex-row gap-2">
                <Button
                  label="Cancel"
                  className="flex-1 bg-muted"
                  onPress={() => setDeleting(null)}
                />
                <Button
                  label="Delete deck"
                  className="flex-1 bg-destructive"
                  onPress={() =>
                    run(
                      () => writes.remove(deck.id),
                      () => setDeleting(null),
                    )
                  }
                />
              </View>
            </View>
          ) : (
            <View className="flex-row gap-4">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${deck.title}`}
                onPress={() => setEditing(deck)}
              >
                <Text className="text-primary">Edit</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${deck.title}`}
                onPress={() => setDeleting(deck)}
              >
                <Text className="text-destructive">Delete</Text>
              </Pressable>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}
