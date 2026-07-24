import { Text as RNText } from 'react-native'
import { cn } from '../../lib/utils'

type TextProps = React.ComponentProps<typeof RNText>

export function Text({ className, ...props }: TextProps) {
  return <RNText className={cn('text-base text-zinc-900', className)} {...props} />
}
