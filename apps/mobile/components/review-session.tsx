import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import type { DatabaseManager } from '@remelondb/core';
import { BASIC_NOTE_TYPE, WORD_NOTE_TYPE } from '@repo/offline-db';
import { authClient } from '@/lib/auth-client';
import { useSessionDatabase } from '@/lib/database-provider';
import { useCards } from '@/lib/cards';
import { useReviewLayout } from '@/lib/use-review-layout';
import { useReviewSession } from '@/lib/use-review-session';
import { useReviewSwipe } from '@/lib/use-review-swipe';
import {
  loadActivationCount,
  saveActivationCount,
} from '@/lib/review-preferences';
import { CardEditor } from './card-editor';
import { ActivationControls } from './review/activation-controls';
import { AnswerButtons } from './review/answer-buttons';
import { DeleteQuestion } from './review/delete-question';
import { ReviewCards } from './review/review-cards';
import { ReviewTopRow } from './review/review-top-row';
import { Button } from './ui/button';
import { Text } from './ui/text';

export function ReviewSession({ deckId }: { deckId: string }) {
  const { manager } = useSessionDatabase();
  const { data: authSession } = authClient.useSession();
  if (!manager) {
    return (
      <View className="items-center py-12">
        <ActivityIndicator />
      </View>
    );
  }
  return (
    <ActiveReviewSession
      manager={manager}
      deckId={deckId}
      userId={authSession?.user.id ?? ''}
    />
  );
}

// The review of one deck. What happens lives in three hooks: the session
// (which card, revealed, saved, the editor), the swipe and the answer
// layout. This component picks the screen for the session's status and
// hands the hooks to the views in ./review.
function ActiveReviewSession({
  manager,
  deckId,
  userId,
}: {
  manager: DatabaseManager;
  deckId: string;
  userId: string;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [activationCount, setActivationCount] = useState('5');
  const [isActivating, setIsActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  useEffect(() => {
    setActivationCount(String(loadActivationCount(userId)));
  }, [userId]);
  const layout = useReviewLayout(userId);
  const session = useReviewSession(manager, deckId, userId);
  const editor = useCards(manager, deckId);
  // Hooks run before the status is known, so without a card the swipe is
  // simply off.
  const card = session.status === 'active' ? session.card : null;
  const canEdit = !!card && editor.canEdit(card);
  const swipe = useReviewSwipe({
    position: session.position,
    hasNext: !!session.nextFront,
    mode: layout.extended ? 'four' : 'two',
    enabled: !!card && session.revealed && !session.busy,
    canDelete: canEdit,
    onAnswer: session.answer,
    onDelete: session.confirmDelete,
  });

  if (session.status === 'loading') {
    return (
      <View className="items-center py-12">
        <ActivityIndicator />
      </View>
    );
  }

  if (session.status === 'error') {
    return (
      <View className="gap-4 py-8">
        <Text className="text-center text-destructive">
          {t('review.recovery.load_error', { message: session.error.message })}
        </Text>
        <Button variant="outline" onPress={() => router.back()}>
          <Text>{t('review.recovery.back_to_deck')}</Text>
        </Button>
      </View>
    );
  }

  if (session.status === 'missing') {
    return (
      <View className="gap-4 py-8">
        <Text className="text-center font-semibold">
          {t('review.recovery.deck_not_found_title')}
        </Text>
        <Button variant="outline" onPress={() => router.back()}>
          <Text>{t('review.recovery.back')}</Text>
        </Button>
      </View>
    );
  }

  const { deck } = session;
  const leave = () => router.replace(`/deck/${deckId}`);

  if (session.status === 'next-batch-failed') {
    return (
      <View className="items-center gap-4 py-12">
        <Stack.Screen options={{ title: deck.title }} />
        <Text className="text-center text-destructive">
          {session.lastStep === 'delete'
            ? t('mobile.messages.deleted_read_failed')
            : session.lastStep === 'activation'
              ? t('mobile.messages.activated_read_failed')
              : t('mobile.messages.saved_read_failed')}
        </Text>
        <Button onPress={session.retryNextBatch}>
          <Text>{t('common.retry')}</Text>
        </Button>
        <Button variant="outline" onPress={leave}>
          <Text>{t('review.recovery.back_to_deck')}</Text>
        </Button>
      </View>
    );
  }

  if (session.status === 'complete' || session.status === 'empty') {
    const activateMore = async () => {
      if (isActivating) return;
      const count = Math.min(
        session.inactiveCount,
        Math.max(1, Math.floor(Number(activationCount) || 5)),
      );
      setIsActivating(true);
      setActivationError(null);
      try {
        await session.activate(count);
        saveActivationCount(userId, count);
      } catch {
        setActivationError(t('review.activation.error'));
      } finally {
        setIsActivating(false);
      }
    };
    return (
      <View className="items-center gap-4 py-12">
        <Stack.Screen options={{ title: deck.title }} />
        <Text className="text-2xl font-semibold">
          {session.status === 'complete'
            ? t('review.activation.complete_title')
            : t('review.recovery.no_cards_due_title')}
        </Text>
        <Text className="text-center text-muted-foreground">
          {session.status === 'complete'
            ? t('review.activation.complete_description')
            : t('review.recovery.no_cards_due', { title: deck.title })}
        </Text>
        {session.inactiveCount > 0 && (
          <ActivationControls
            count={activationCount}
            onChangeCount={setActivationCount}
            onActivate={() => void activateMore()}
            isActivating={isActivating}
            error={activationError}
            inactiveItemCount={session.inactiveCount}
            itemLabel={session.itemLabel}
          />
        )}
        <Button onPress={leave}>
          <Text>{t('review.recovery.back_to_deck')}</Text>
        </Button>
      </View>
    );
  }

  const { card: current, editing, revealed, busy } = session;

  // Deleting removes the whole note, so its other cards leave the rest of
  // the session too; then it moves on as after an answer, without counting
  // one.
  if (editing?.kind === 'delete' && editor.writes) {
    return (
      <View className="gap-4">
        <Stack.Screen options={{ title: deck.title }} />
        <DeleteQuestion
          card={editing.card}
          note={editor.noteForCard(editing.card)}
          writes={editor.writes}
          onCancel={session.closeEditor}
          onDeleted={() => session.noteDeleted(editing.card.note_id)}
        />
      </View>
    );
  }

  // The editor replaces the card until it is saved or cancelled; the
  // session keeps its place, and an edit shows on the same card.
  if (editing && editor.deck && editor.writes) {
    const editCard = editing.kind === 'edit' ? editing.card : undefined;
    return (
      <View className="gap-4">
        <Stack.Screen options={{ title: deck.title }} />
        <CardEditor
          deck={editor.deck}
          card={editCard}
          note={editCard ? editor.noteForCard(editCard) : null}
          writes={editor.writes}
          onDone={session.closeEditor}
          onDeleted={() => {
            if (editCard) session.noteDeleted(editCard.note_id);
            else session.closeEditor();
          }}
        />
      </View>
    );
  }

  const isWordDeck = deck.note_type === WORD_NOTE_TYPE;
  const canAdd = isWordDeck || deck.note_type === BASIC_NOTE_TYPE;
  const edit = canEdit ? () => session.edit() : undefined;
  const locked = busy || swipe.isLeaving;

  return (
    <View className="flex-1 gap-4">
      <Stack.Screen options={{ title: deck.title }} />
      <ReviewTopRow
        answered={session.progress.answered}
        total={session.progress.total}
        locked={locked}
        addLabel={
          isWordDeck
            ? t('mobile.messages.add_word')
            : t('mobile.messages.add_card')
        }
        onEdit={edit}
        onAdd={canAdd ? session.add : undefined}
      />
      <ReviewCards
        card={current}
        nextFront={session.nextFront}
        revealed={revealed}
        busy={busy}
        swipe={swipe}
        extended={layout.extended}
        deleteLabel={
          isWordDeck
            ? t('mobile.messages.delete_word')
            : t('mobile.messages.delete_card')
        }
        onReveal={session.reveal}
        onEdit={edit}
      />

      {session.saveError ? (
        <Text className="text-center text-destructive">
          {session.saveError}
        </Text>
      ) : null}

      {layout.hint && (
        <Text className="text-center text-sm text-muted-foreground">
          {layout.hint}
        </Text>
      )}

      <AnswerButtons
        revealed={revealed}
        locked={locked}
        layout={layout}
        intervalMinutes={current.scheduled_interval_minutes}
        onReveal={session.reveal}
        onAnswer={(answer) => void session.answer(answer)}
      />
    </View>
  );
}
