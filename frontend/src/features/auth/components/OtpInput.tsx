import React, { useRef, useState } from 'react';
import { OTP_LENGTH } from '@/shared/config/constants';
import { toEnglishDigits } from '@/shared/lib/formatters';
import { cn } from '@/shared/lib/utils';

interface OtpInputProps {
  onComplete: (code: string) => void;
  onChange?: (code: string) => void;
  isLoading?: boolean;
  hasError?: boolean;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  onComplete,
  onChange,
  isLoading,
  hasError,
}) => {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const triggerChange = (newDigits: string[]) => {
    setDigits(newDigits);
    const full = newDigits.join('');
    onChange?.(full);
    if (full.length === OTP_LENGTH && !newDigits.some((d) => d === '')) {
      onComplete(full);
    }
  };

  const handleChange = (index: number, val: string) => {
    const rawClean = toEnglishDigits(val).replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    if (!rawClean) {
      // User cleared the input
      const next = [...digits];
      next[index] = '';
      triggerChange(next);
      return;
    }

    if (rawClean.length > 1) {
      // Multiple characters typed or pasted
      const next = [...digits];
      for (let i = 0; i < rawClean.length && index + i < OTP_LENGTH; i++) {
        next[index + i] = rawClean[i];
      }
      triggerChange(next);
      const nextFocus = Math.min(index + rawClean.length, OTP_LENGTH - 1);
      inputsRef.current[nextFocus]?.focus();
      return;
    }

    const char = rawClean.slice(-1);
    const next = [...digits];
    next[index] = char;
    triggerChange(next);

    if (char && index < OTP_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[index]) {
        // Clear current
        const next = [...digits];
        next[index] = '';
        triggerChange(next);
      } else if (index > 0) {
        // Clear previous and focus it
        const next = [...digits];
        next[index - 1] = '';
        triggerChange(next);
        inputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (index > 0) inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (index < OTP_LENGTH - 1) inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = toEnglishDigits(e.clipboardData.getData('text'))
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, OTP_LENGTH);

    if (!pasted) return;

    const next = Array(OTP_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    triggerChange(next);
    inputsRef.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  return (
    <div dir="ltr" className={cn('flex justify-center gap-1.5 min-[370px]:gap-2 sm:gap-3', hasError && 'animate-bounce')}>
      {digits.map((digit, idx) => (
        <input
          key={idx}
          ref={(el) => { inputsRef.current[idx] = el; }}
          type="text"
          autoCapitalize="characters"
          value={digit}
          disabled={isLoading}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          maxLength={OTP_LENGTH}
          autoFocus={idx === 0}
          className={cn(
            'w-9 h-12 min-[370px]:w-11 min-[370px]:h-13 sm:w-13 sm:h-15 text-center text-lg sm:text-xl font-bold rounded-xl border bg-white dark:bg-[#1C2536] text-ink-normal dark:text-white shadow-hard-sm transition-all focus:outline-none uppercase',
            hasError
              ? 'border-[#C60036] ring-1 ring-[#C60036]'
              : 'border-gray-200 dark:border-gray-700 focus:border-primary focus:shadow-ecosystem'
          )}
        />
      ))}
    </div>
  );
};
