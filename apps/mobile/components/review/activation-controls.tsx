import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Text } from '../ui/text';

export function ActivationControls({
  count,
  onChangeCount,
  onActivate,
  isActivating,
  error,
  inactiveItemCount,
  itemLabel,
}: {
  count: string;
  onChangeCount: (value: string) => void;
  onActivate: () => void;
  isActivating: boolean;
  error: string | null;
  inactiveItemCount: number;
  itemLabel: 'words' | 'cards';
}) {
  const { t } = useTranslation();
  const selectedCount = Math.min(
    inactiveItemCount,
    Math.max(1, Math.floor(Number(count) || 5)),
  );
  return (
    <>
      <Text>{t('review.activation.activate', 'Activate')}</Text>
      <Input
        value={String(selectedCount)}
        onChangeText={onChangeCount}
        keyboardType="number-pad"
        accessibilityLabel={t(
          'review.activation.count_label',
          'Number of items to activate',
        )}
        className="w-20 text-center"
      />
      <Text>
        {itemLabel === 'cards'
          ? t(
              inactiveItemCount === 1
                ? 'review.activation.more_card'
                : 'review.activation.more_cards',
              { count: inactiveItemCount },
            )
          : t(
              inactiveItemCount === 1
                ? 'review.activation.more_word'
                : 'review.activation.more_words',
              { count: inactiveItemCount },
            )}
      </Text>
      <Button onPress={onActivate} disabled={isActivating}>
        <Text>{t('review.activation.continue', 'Activate and continue')}</Text>
      </Button>
      {error && <Text className="text-destructive">{error}</Text>}
    </>
  );
}
