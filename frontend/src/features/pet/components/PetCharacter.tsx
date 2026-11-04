import React from 'react';
import type { PetType } from '../hooks/use-pet-store';
import type { TimerState } from '@/features/timer/hooks/use-timer';
import { cn } from '@/shared/lib/utils';

interface PetCharacterProps {
  type: PetType;
  timerState?: TimerState;
  isWalking?: boolean;
  direction?: 'left' | 'right';
  className?: string;
  isHappy?: boolean;
}

export const PetCharacter: React.FC<PetCharacterProps> = ({
  type,
  timerState = 'IDLE',
  isWalking = false,
  direction = 'right',
  className,
  isHappy = false,
}) => {
  const isSleeping = timerState === 'BREAK';

  return (
    <div
      className={cn(
        'relative select-none transition-transform duration-200',
        direction === 'left' ? 'scale-x-[-1]' : 'scale-x-1',
        isWalking && 'animate-bounce',
        isHappy && '-translate-y-2',
        className
      )}
      style={{
        animationDuration: isWalking ? '0.35s' : undefined,
      }}
    >
      {/* Sleeping Zzz indicator */}
      {isSleeping && (
        <div className="absolute -top-4 -right-1 text-xs font-black font-mono text-primary animate-pulse flex gap-0.5">
          <span className="animate-bounce" style={{ animationDelay: '0ms' }}>z</span>
          <span className="animate-bounce text-[10px]" style={{ animationDelay: '150ms' }}>z</span>
          <span className="animate-bounce text-[8px]" style={{ animationDelay: '300ms' }}>z</span>
        </div>
      )}

      {/* Heart indicator when clicked / happy */}
      {isHappy && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-bold text-girl animate-bounce">
          ❤️
        </div>
      )}

      {/* CAT */}
      {type === 'cat' && (
        <svg viewBox="0 0 48 48" className="w-12 h-12 drop-shadow-hard-sm">
          {/* Tail */}
          <path
            d="M8 32 C4 26 6 18 10 16"
            stroke="#202A5A"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
            className={cn('transition-all origin-bottom', isWalking && 'animate-pulse')}
          />
          {/* Body */}
          <ellipse cx="22" cy="30" rx="14" ry="10" fill="#F8A41D" stroke="#202A5A" strokeWidth="2.5" />
          {/* Stripes */}
          <path d="M18 24 L20 28 M24 23 L25 28 M28 24 L27 28" stroke="#E67E22" strokeWidth="2" strokeLinecap="round" />
          {/* Head */}
          <circle cx="32" cy="22" r="9" fill="#F8A41D" stroke="#202A5A" strokeWidth="2.5" />
          {/* Ears */}
          <polygon points="26,16 28,9 33,14" fill="#E67E22" stroke="#202A5A" strokeWidth="2" strokeLinejoin="round" />
          <polygon points="34,14 38,9 40,16" fill="#E67E22" stroke="#202A5A" strokeWidth="2" strokeLinejoin="round" />
          {/* Eyes */}
          {isSleeping ? (
            <>
              <path d="M29 22 Q31 24 33 22" stroke="#202A5A" strokeWidth="2" fill="none" />
              <path d="M35 22 Q37 24 39 22" stroke="#202A5A" strokeWidth="2" fill="none" />
            </>
          ) : (
            <>
              <circle cx="31" cy="21" r="1.5" fill="#202A5A" />
              <circle cx="37" cy="21" r="1.5" fill="#202A5A" />
            </>
          )}
          {/* Nose & Whiskers */}
          <polygon points="34,23 33.5,24.5 34.5,24.5" fill="#E0195B" />
          <path d="M28 23 L24 22 M28 25 L24 26 M38 23 L42 22 M38 25 L42 26" stroke="#202A5A" strokeWidth="1.2" />
          {/* Paws */}
          <ellipse cx="14" cy="39" rx="3.5" ry="2.5" fill="#FFFFFF" stroke="#202A5A" strokeWidth="2" />
          <ellipse cx="28" cy="39" rx="3.5" ry="2.5" fill="#FFFFFF" stroke="#202A5A" strokeWidth="2" />
        </svg>
      )}

      {/* DOG */}
      {type === 'dog' && (
        <svg viewBox="0 0 48 48" className="w-12 h-12 drop-shadow-hard-sm">
          {/* Tail */}
          <path d="M6 26 Q4 18 10 20" stroke="#202A5A" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          {/* Body */}
          <ellipse cx="20" cy="30" rx="13" ry="9" fill="#E8B878" stroke="#202A5A" strokeWidth="2.5" />
          {/* Head */}
          <circle cx="32" cy="22" r="9" fill="#E8B878" stroke="#202A5A" strokeWidth="2.5" />
          {/* Floppy Ear */}
          <ellipse cx="26" cy="21" rx="3.5" ry="6" fill="#C98B4A" stroke="#202A5A" strokeWidth="2" transform="rotate(-15 26 21)" />
          {/* Snout */}
          <ellipse cx="37" cy="24" rx="4" ry="3" fill="#FFFFFF" stroke="#202A5A" strokeWidth="1.5" />
          <circle cx="38.5" cy="22.5" r="1.5" fill="#202A5A" />
          {/* Eyes */}
          {isSleeping ? (
            <path d="M30 20 Q32 22 34 20" stroke="#202A5A" strokeWidth="2" fill="none" />
          ) : (
            <circle cx="32" cy="19" r="1.5" fill="#202A5A" />
          )}
          {/* Tongue if happy */}
          {(isHappy || isWalking) && (
            <path d="M37 26 C37 29 39 29 39 26 Z" fill="#E0195B" stroke="#202A5A" strokeWidth="1" />
          )}
          {/* Paws */}
          <ellipse cx="14" cy="39" rx="3.5" ry="2.5" fill="#FFFFFF" stroke="#202A5A" strokeWidth="2" />
          <ellipse cx="26" cy="39" rx="3.5" ry="2.5" fill="#FFFFFF" stroke="#202A5A" strokeWidth="2" />
        </svg>
      )}

      {/* ROBOT */}
      {type === 'robot' && (
        <svg viewBox="0 0 48 48" className="w-12 h-12 drop-shadow-hard-sm">
          {/* Antenna */}
          <line x1="24" y1="12" x2="24" y2="6" stroke="#202A5A" strokeWidth="2.5" />
          <circle cx="24" cy="5" r="2.5" fill={isSleeping ? '#94A3B8' : '#59BBAF'} stroke="#202A5A" strokeWidth="1.5" className={cn(!isSleeping && 'animate-pulse')} />
          {/* Head / Body Box */}
          <rect x="12" y="12" width="24" height="20" rx="5" fill="#E2E8F0" stroke="#202A5A" strokeWidth="2.5" />
          {/* Screen Face */}
          <rect x="16" y="16" width="16" height="12" rx="3" fill="#151C28" stroke="#202A5A" strokeWidth="1.5" />
          {/* Screen Eyes */}
          {isSleeping ? (
            <text x="18" y="24" fill="#94A3B8" fontSize="7" fontFamily="monospace" fontWeight="bold">-_-</text>
          ) : isHappy ? (
            <text x="18" y="25" fill="#59BBAF" fontSize="8" fontFamily="monospace" fontWeight="bold">^o^</text>
          ) : (
            <>
              <circle cx="20" cy="22" r="1.5" fill="#59BBAF" />
              <circle cx="28" cy="22" r="1.5" fill="#59BBAF" />
            </>
          )}
          {/* Wheels / Treads */}
          <rect x="14" y="32" width="20" height="7" rx="3" fill="#64748B" stroke="#202A5A" strokeWidth="2" />
          <circle cx="18" cy="35.5" r="1.5" fill="#E2E8F0" />
          <circle cx="24" cy="35.5" r="1.5" fill="#E2E8F0" />
          <circle cx="30" cy="35.5" r="1.5" fill="#E2E8F0" />
        </svg>
      )}

      {/* DUCK */}
      {type === 'duck' && (
        <svg viewBox="0 0 48 48" className="w-12 h-12 drop-shadow-hard-sm">
          {/* Body */}
          <ellipse cx="20" cy="31" rx="13" ry="9" fill="#FACC15" stroke="#202A5A" strokeWidth="2.5" />
          {/* Head */}
          <circle cx="31" cy="20" r="8" fill="#FACC15" stroke="#202A5A" strokeWidth="2.5" />
          {/* Beak */}
          <polygon points="36,19 44,22 36,25" fill="#F97316" stroke="#202A5A" strokeWidth="1.5" strokeLinejoin="round" />
          {/* Eye */}
          {isSleeping ? (
            <path d="M29 19 Q31 21 33 19" stroke="#202A5A" strokeWidth="2" fill="none" />
          ) : (
            <circle cx="31" cy="18" r="1.5" fill="#202A5A" />
          )}
          {/* Wing */}
          <ellipse cx="18" cy="30" rx="7" ry="4.5" fill="#EAB308" stroke="#202A5A" strokeWidth="2" />
          {/* Feet */}
          <ellipse cx="16" cy="40" rx="3.5" ry="1.5" fill="#F97316" stroke="#202A5A" strokeWidth="1.5" />
          <ellipse cx="24" cy="40" rx="3.5" ry="1.5" fill="#F97316" stroke="#202A5A" strokeWidth="1.5" />
        </svg>
      )}

      {/* GHOST */}
      {type === 'ghost' && (
        <svg viewBox="0 0 48 48" className="w-12 h-12 drop-shadow-hard-sm">
          {/* Ghost Body */}
          <path
            d="M14 24 C14 14 34 14 34 24 L34 38 L30 35 L26 38 L22 35 L18 38 L14 35 Z"
            fill="#FFFFFF"
            stroke="#202A5A"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Eyes */}
          {isSleeping ? (
            <>
              <path d="M19 22 Q21 24 23 22" stroke="#202A5A" strokeWidth="2" fill="none" />
              <path d="M25 22 Q27 24 29 22" stroke="#202A5A" strokeWidth="2" fill="none" />
            </>
          ) : isHappy ? (
            <>
              <path d="M19 23 Q21 20 23 23" stroke="#202A5A" strokeWidth="2" fill="none" />
              <path d="M25 23 Q27 20 29 23" stroke="#202A5A" strokeWidth="2" fill="none" />
            </>
          ) : (
            <>
              <circle cx="21" cy="22" r="2" fill="#202A5A" />
              <circle cx="27" cy="22" r="2" fill="#202A5A" />
            </>
          )}
          {/* Blush */}
          <circle cx="18" cy="25" r="1.5" fill="#F472B6" opacity="0.8" />
          <circle cx="30" cy="25" r="1.5" fill="#F472B6" opacity="0.8" />
        </svg>
      )}
    </div>
  );
};
