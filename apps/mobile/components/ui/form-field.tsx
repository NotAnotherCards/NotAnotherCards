import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form'
import { View, type TextInputProps } from 'react-native'
import { Input } from './input'
import { Label } from './label'
import { Text } from './text'

type FormFieldProps<T extends FieldValues> = {
  control: Control<T>
  name: FieldPath<T>
  label: string
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'onBlur'>

export function FormField<T extends FieldValues>({
  control,
  name,
  label,
  ...inputProps
}: FormFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState }) => (
        <View className="gap-1">
          <Label>{label}</Label>
          <Input
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            invalid={fieldState.invalid}
            {...inputProps}
          />
          {fieldState.error && (
            <Text className="text-sm text-red-600">
              {fieldState.error.message}
            </Text>
          )}
        </View>
      )}
    />
  )
}
