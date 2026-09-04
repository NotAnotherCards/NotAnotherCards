import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { useId, useRef } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { cn } from '@/lib/utils';
import { Input } from './input';
import { Label } from './label';
import { Text } from './text';

type FormFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'onBlur'>;

export function FormField<T extends FieldValues>({
  control,
  name,
  label,
  ...inputProps
}: FormFieldProps<T>) {
  const generatedInputId = useId();
  const inputId = inputProps.nativeID ?? generatedInputId;
  const labelId = `${inputId}-label`;
  const inputRef = useRef<TextInput>(null);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState }) => (
        <View className="gap-1">
          <Label
            nativeID={labelId}
            htmlFor={inputId}
            onPress={() => inputRef.current?.focus()}
          >
            {label}
          </Label>
          <Input
            ref={inputRef}
            nativeID={inputId}
            aria-labelledby={labelId}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            aria-invalid={fieldState.invalid}
            {...inputProps}
            className={cn(
              fieldState.invalid && 'border-destructive',
              inputProps.className,
            )}
          />
          {fieldState.error && (
            <Text className="text-sm text-destructive">
              {fieldState.error.message}
            </Text>
          )}
        </View>
      )}
    />
  );
}
