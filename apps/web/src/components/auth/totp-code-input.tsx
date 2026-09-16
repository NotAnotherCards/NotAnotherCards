import { useRef } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type TotpCodeInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  errorId?: string;
  autoFocus?: boolean;
};

const CODE_LENGTH = 6;

export function TotpCodeInput({
  value,
  onChange,
  disabled = false,
  errorId,
  autoFocus = false,
}: TotpCodeInputProps) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH);

  const updateDigit = (index: number, rawValue: string) => {
    const incoming = rawValue.replace(/\D/g, '');
    if (incoming.length >= CODE_LENGTH) {
      onChange(incoming.slice(0, CODE_LENGTH));
      inputs.current[CODE_LENGTH - 1]?.focus();
      return;
    }

    const next = digits.split('');
    next[index] = incoming.slice(-1);
    onChange(next.join('').slice(0, CODE_LENGTH));
    if (incoming && index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">
        Six-digit authentication code
      </legend>
      <div
        className="grid grid-cols-6 gap-1.5 sm:gap-2"
        aria-describedby={errorId}
      >
        {Array.from({ length: CODE_LENGTH }, (_, index) => (
          <Input
            key={index}
            ref={(element) => {
              inputs.current[index] = element;
            }}
            value={digits[index] ?? ''}
            onChange={(event) => updateDigit(index, event.target.value)}
            onPaste={(event) => {
              const pasted = event.clipboardData
                .getData('text')
                .replace(/\D/g, '');
              if (!pasted) return;
              event.preventDefault();
              onChange(pasted.slice(0, CODE_LENGTH));
              inputs.current[Math.min(pasted.length, CODE_LENGTH) - 1]?.focus();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Backspace' && !digits[index] && index > 0) {
                inputs.current[index - 1]?.focus();
              }
              if (event.key === 'ArrowLeft' && index > 0) {
                event.preventDefault();
                inputs.current[index - 1]?.focus();
              }
              if (event.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
                event.preventDefault();
                inputs.current[index + 1]?.focus();
              }
            }}
            onFocus={(event) => event.currentTarget.select()}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
            aria-invalid={Boolean(errorId)}
            aria-describedby={errorId}
            disabled={disabled}
            autoFocus={autoFocus && index === 0}
            className={cn(
              'h-11 w-full px-0 text-center text-lg font-semibold sm:h-12',
              errorId && 'border-destructive',
            )}
          />
        ))}
      </div>
    </fieldset>
  );
}
