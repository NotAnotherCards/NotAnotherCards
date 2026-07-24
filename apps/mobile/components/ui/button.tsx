import { ActivityIndicator, Pressable, Text } from 'react-native'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'flex-row items-center justify-center rounded-lg',
  {
    variants: {
      variant: {
        default: 'bg-zinc-900',
      },
      size: {
        default: 'px-4 py-3',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

type ButtonProps = React.ComponentProps<typeof Pressable> &
  VariantProps<typeof buttonVariants> & {
    label: string
    loading?: boolean
  }

export function Button({
  className,
  variant,
  size,
  label,
  loading,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      className={cn(
        buttonVariants({ variant, size }),
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
