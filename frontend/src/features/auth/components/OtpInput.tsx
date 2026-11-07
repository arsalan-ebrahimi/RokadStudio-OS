import React, { useRef, useState } from 'react';
import { OTP_LENGTH } from '@/shared/config/constants';
import { toEnglishDigits } from '@/shared/lib/formatters';
import { cn } from '@/shared/lib/utils';

interface OtpInputProps {
  onComplete: (code: string) => void;
  isLoading?: boolean;
  hasError?: boolean;
}

export const OtpInput: React.FC<OtpInputProps> = ({ onComplete, isLoading, hasError }) => {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const triggerChange = (newDigits: string[]) => {
    setDigits(newDigits);
    const full = newDigits.join('');
    if (full.length === OTP_LENGTH) onComplete(full);
  };

  const handleChange = (index: number, val: string) => {
    const char = toEnglishDigits(val).replace(/\D/g, '').slice(-1);
    if (!/^\d$/.test(char)) return;

    const next = [...digits];
    next[index] = char;
    triggerChange(next);
    if (char && index < OTP_LENGTH - 1) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = toEnglishDigits(e.clipboardData.getData('text')).replace(/\D/g, '').slice(0, OTP_LENGTH);
    const next = [...digits];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
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
          inputMode="numeric"
          pattern="[0-9]*"
          value={digit}
          disabled={isLoading}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          onPaste={handlePaste}
          maxLength={1}
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

