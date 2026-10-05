import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button } from '../ui/button';
import { PencilIcon, PlusIcon } from '../ui/icon';
import { Text } from '../ui/text';

// Leaving is the header's back arrow, so this row keeps the progress and
// the two writes web's review offers. A write that does not apply to the
// card or the deck is left out.
export function ReviewTopRow({
  answered,
  total,
  locked,
  addLabel,
  onEdit,
  onAdd,
}: {
  answered: number;
  total: number;
  locked: boolean;
  addLabel: string;
  onEdit?: () => void;
  onAdd?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-sm font-semibold text-muted-foreground">
        {t('mobile.messages.progress', { current: answered + 1, total })}
      </Text>
      <View className="flex-row gap-1">
        {onEdit && (
          <Button
            variant="ghost"
            size="icon"
            accessibilityLabel={t('mobile.messages.edit_card_hint')}
            // Like the answers: locked for a moment, not faded.
            className="opacity-100"
            disabled={locked}
            onPress={onEdit}
          >
            <PencilIcon size={18} className="text-muted-foreground" />
          </Button>
        )}
        {onAdd && (
          <Button
            variant="ghost"
            size="icon"
            accessibilityLabel={addLabel}
            // Like the answers: locked for a moment, not faded.
            className="opacity-100"
            disabled={locked}
            onPress={onAdd}
          >
            <PlusIcon size={20} className="text-muted-foreground" />
          </Button>
        )}
      </View>
    </View>
  );
}
