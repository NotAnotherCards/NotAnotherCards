import { ActivityIndicator, Pressable, Text } from 'react-native'
import { cn } from '../../lib/utils'

type ButtonProps = React.ComponentProps<typeof Pressable> & {
  label: string
  loading?: boolean
}

export function Button({
  className,
  label,
  loading,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      className={cn(
        'flex-row items-center justify-center rounded-lg bg-zinc-900 px-4 py-3',
        (disabled || loading) && 'opacity-60',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text className="text-base font-semibold text-white">{label}</Text>
      )}
    </Pressable>
  )
}
