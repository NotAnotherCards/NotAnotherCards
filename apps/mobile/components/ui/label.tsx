import { Text as RNText } from 'react-native'
import { cn } from '../../lib/utils'

type LabelProps = React.ComponentProps<typeof RNText>

export function Label({ className, ...props }: LabelProps) {
  return (
    <RNText
      className={cn('text-sm font-medium text-zinc-900', className)}
      {...props}
    />
  )
}
