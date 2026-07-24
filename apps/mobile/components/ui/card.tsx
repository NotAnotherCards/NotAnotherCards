import { View } from 'react-native'
import { cn } from '../../lib/utils'

type CardProps = React.ComponentProps<typeof View>

export function Card({ className, ...props }: CardProps) {
  return (
    <View
      className={cn('rounded-xl border border-zinc-200 bg-white p-6', className)}
      {...props}
    />
  )
}
