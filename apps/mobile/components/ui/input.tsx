import { TextInput } from 'react-native'
import { cn } from '@/lib/utils'

type InputProps = React.ComponentProps<typeof TextInput> & {
  invalid?: boolean
}

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <TextInput
      className={cn(
        'rounded-lg border border-input px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground',
        invalid && 'border-destructive',
        className,
      )}
      {...props}
    />
  )
}
