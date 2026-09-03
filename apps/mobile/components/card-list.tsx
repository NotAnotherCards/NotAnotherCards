import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { DatabaseManager } from '@remelondb/core';
import { useSessionDatabase } from '@/lib/database-provider';
import { useCards, type Card as CardRecord } from '@/lib/cards';
import { writeErrorMessage } from '@/lib/errors';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Text } from './ui/text';
import { CardForm } from './card-form';

// Readiness gate, as DeckList: no manager yet means no database to query.
export function CardList({ deckId }: { deckId: string }) {
  const { manager } = useSessionDatabase();
  if (!manager) {
    return (
      <View className="items-center py-6">
        <ActivityIndicator />
      </View>
    );
  }
  return <ActiveCardList manager={manager} deckId={deckId} />;
}

// One action at a time, same union as DeckList. Two removal scopes, and
// the confirmation copy is what tells them apart: remove ends this deck's
// membership and keeps the note, delete takes the note everywhere.
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
  const { deck, cards, isLoading, error, canEdit, writes } = useCards(
    manager,
    deckId,
  );
  const [action, setAction] = useState<CardAction | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const open = (next: CardAction | null) => {
    setWriteError(null);
    setPending(false);
    setAction(next);
  };

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
        Failed to load cards: {error.message}
      </Text>
    );
  }

  if (!deck) {
    return (
      <Text className="text-muted-foreground">
        This deck is not on this device.
      </Text>
    );
  }

  if (action?.kind === 'create') {
    return (
      <CardForm
        title="New card"
        error={writeError}
        onSubmit={(values) =>
          run(() => writes.create(deckId, values.front, values.back))
        }
        onCancel={() => open(null)}
      />
    );
  }

  if (action?.kind === 'edit') {
    const { card } = action;
    return (
      <CardForm
        title="Edit card"
        initialValues={{ front: card.front, back: card.back }}
        error={writeError}
        onSubmit={(values) =>
          run(() => writes.update(card.id, values.front, values.back))
        }
        onCancel={() => open(null)}
      />
    );
  }

  const confirming = (card: CardRecord) =>
    (action?.kind === 'remove' || action?.kind === 'delete') &&
    action.card.id === card.id
      ? action.kind
      : null;

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold">Cards</Text>
        <Button onPress={() => open({ kind: 'create' })}>
          <Text>New card</Text>
        </Button>
      </View>
      {cards.length === 0 && (
        <Text className="text-muted-foreground">
          No cards yet. Add your first one.
        </Text>
      )}
      {cards.map((card) => {
        const confirm = confirming(card);
        return (
          <Card key={card.id}>
            <CardHeader>
              <CardTitle>{card.front}</CardTitle>
              <Text className="text-sm text-muted-foreground">{card.back}</Text>
            </CardHeader>
            <CardContent>
              {confirm ? (
                <View className="gap-2">
                  <Text className="text-sm">
                    {confirm === 'remove'
                      ? 'Remove this card from the deck? The note stays, and so does any other deck it is in.'
                      : 'Delete this note? Its cards, deck memberships and review history go with it.'}
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
                          ? 'Remove from deck'
                          : 'Delete note'}
                      </Text>
                    </Button>
                  </View>
                </View>
              ) : (
                <View className="flex-row gap-2">
                  {canEdit(card) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      accessibilityLabel={`Edit ${card.front}`}
                      onPress={() => open({ kind: 'edit', card })}
                    >
                      <Text className="text-primary">Edit</Text>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    accessibilityLabel={`Remove ${card.front} from deck`}
                    onPress={() => open({ kind: 'remove', card })}
                  >
                    <Text>Remove</Text>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    accessibilityLabel={`Delete note ${card.front}`}
                    onPress={() => open({ kind: 'delete', card })}
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
  );
}
