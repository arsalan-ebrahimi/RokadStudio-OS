import React, { useState, useEffect, useRef } from 'react';
import { usePetStore } from '../hooks/use-pet-store';
import { PetCharacter } from './PetCharacter';
import type { TimerState } from '@/features/timer/hooks/use-timer';

interface ScreenPetProps {
  timerState?: TimerState;
  onOpenSelector?: () => void;
}

export const ScreenPet: React.FC<ScreenPetProps> = ({ timerState = 'IDLE', onOpenSelector }) => {
  const { petType, isEnabled } = usePetStore();
  const [posX, setPosX] = useState(120); // pixels from start (right in RTL / left in LTR)
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [isHappy, setIsHappy] = useState(false);
  const happyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isRunning = timerState === 'RUNNING';
  const isSleeping = timerState === 'BREAK';

  // Walking loop when running or idle
  useEffect(() => {
    if (!isEnabled || petType === 'none' || isSleeping) return;

    const interval = setInterval(() => {
      const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
      const minX = 24;
      const maxX = Math.max(minX + 100, screenWidth - 80);

      setPosX((prev) => {
        let next = direction === 'right' ? prev + 2.5 : prev - 2.5;

        if (next >= maxX) {
          next = maxX;
          setDirection('left');
        } else if (next <= minX) {
          next = minX;
          setDirection('right');
        }

        return next;
      });
    }, 60);

    return () => clearInterval(interval);
  }, [direction, isEnabled, petType, isSleeping]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsHappy(true);
    if (happyTimeoutRef.current) clearTimeout(happyTimeoutRef.current);
    happyTimeoutRef.current = setTimeout(() => {
      setIsHappy(false);
    }, 1200);

    // If double clicked or quick tap, can open selector
    if (onOpenSelector && e.detail === 2) {
      onOpenSelector();
    }
  };

  if (!isEnabled || petType === 'none') return null;

  return (
    <div
      className="fixed bottom-2 z-40 pointer-events-none transition-all duration-75 ease-linear"
      style={{
        left: `${posX}px`,
      }}
    >
      <div
        onClick={handleClick}
        onDoubleClick={onOpenSelector}
        className="pointer-events-auto cursor-pointer p-1 group flex flex-col items-center"
        title="همراه شما در تمرکز (۲ بار کلیک برای تغییر)"
      >
        <PetCharacter
          type={petType}
          timerState={timerState}
          isWalking={isRunning && !isSleeping}
          direction={direction}
          isHappy={isHappy}
        />
      </div>
    </div>
  );
};
