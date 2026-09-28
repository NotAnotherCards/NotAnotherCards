import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type TotpCodeInputProps = {
  value: readonly string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  errorId?: string;
  autoFocus?: boolean;
};

const CODE_LENGTH = 6;

export const emptyTotpDigits = (): string[] =>
  Array.from({ length: CODE_LENGTH }, () => '');

export function TotpCodeInput({
  value,
  onChange,
  disabled = false,
  errorId,
  autoFocus = false,
}: TotpCodeInputProps) {
  const { t } = useTranslation();
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from(
    { length: CODE_LENGTH },
    (_, index) => value[index]?.replace(/\D/g, '').slice(-1) ?? '',
  );

  const updateDigit = (index: number, rawValue: string) => {
    const incoming = rawValue.replace(/\D/g, '');
    if (incoming.length > 1) {
      const next = [...digits];
      incoming
        .slice(0, CODE_LENGTH - index)
        .split('')
        .forEach((digit, offset) => {
          next[index + offset] = digit;
        });
      onChange(next);
      inputs.current[
        Math.min(index + incoming.length, CODE_LENGTH) - 1
      ]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = incoming.slice(-1);
    onChange(next);
    if (incoming && index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">
        {t('auth.two_factor.totp_legend')}
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
              const next = [...digits];
              pasted
                .slice(0, CODE_LENGTH - index)
                .split('')
                .forEach((digit, offset) => {
                  next[index + offset] = digit;
                });
              onChange(next);
              inputs.current[
                Math.min(index + pasted.length, CODE_LENGTH) - 1
              ]?.focus();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Backspace') {
                event.preventDefault();
                const next = [...digits];
                if (digits[index]) {
                  next[index] = '';
                  onChange(next);
                } else if (index > 0) {
                  next[index - 1] = '';
                  onChange(next);
                  inputs.current[index - 1]?.focus();
                }
              }
              if (event.key === 'Delete') {
                event.preventDefault();
                const next = [...digits];
                next[index] = '';
                onChange(next);
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
            aria-label={t('auth.two_factor.totp_digit_aria', {
              digit: index + 1,
              total: CODE_LENGTH,
            })}
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
