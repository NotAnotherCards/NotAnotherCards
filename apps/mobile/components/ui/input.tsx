import { TextInput } from 'react-native'
import { cn } from '../../lib/utils'

type InputProps = React.ComponentProps<typeof TextInput> & {
  invalid?: boolean
}

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <TextInput
      className={cn(
        'rounded-lg border border-zinc-300 px-3 py-2.5 text-base text-zinc-900',
        invalid && 'border-red-600',
        className,
      )}
      placeholderTextColor="#a1a1aa"
      {...props}
    />
  )
}
