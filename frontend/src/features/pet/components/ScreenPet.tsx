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
  const [posX, setPosX] = useState(120);
  // Facing direction: start facing left because we move right (jumping backwards!)
  const [facingDirection, setFacingDirection] = useState<'left' | 'right'>('left');
  const [isHappy, setIsHappy] = useState(false);
  const [isBumping, setIsBumping] = useState(false);

  const motionRef = useRef({
    posX: 120,
    movingDirection: 'right' as 'left' | 'right',
  });
  const bumpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const happyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isRunning = timerState === 'RUNNING';
  const isSleeping = timerState === 'BREAK';

  // Backwards hopping loop: active when timer is running and not on break
  useEffect(() => {
    if (!isEnabled || petType === 'none' || !isRunning || isSleeping) return;

    const interval = setInterval(() => {
      const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
      const petWidth = 56;
      const minX = 24;
      const maxX = Math.max(minX + 80, screenWidth - petWidth - 24);

      const currentMoving = motionRef.current.movingDirection;
      const step = 2.5;
      let nextX = currentMoving === 'right' ? motionRef.current.posX + step : motionRef.current.posX - step;
      let newMoving = currentMoving;
      let hitWall = false;

      // When jumping backwards:
      // moving 'right' -> back hits right wall (maxX)
      // moving 'left' -> back hits left wall (minX)
      if (nextX >= maxX) {
        nextX = maxX;
        newMoving = 'left';
        hitWall = true;
      } else if (nextX <= minX) {
        nextX = minX;
        newMoving = 'right';
        hitWall = true;
      }

      motionRef.current.posX = nextX;
      motionRef.current.movingDirection = newMoving;
      setPosX(nextX);

      // Backwards hopping: facing direction is opposite to moving direction!
      // When moving right, face left (so rear is in front, jumping backwards).
      // When moving left, face right (so rear is in front, jumping backwards).
      const nextFacing = newMoving === 'right' ? 'left' : 'right';
      setFacingDirection(nextFacing);

      if (hitWall) {
        setIsBumping(true);
        if (bumpTimeoutRef.current) clearTimeout(bumpTimeoutRef.current);
        bumpTimeoutRef.current = setTimeout(() => {
          setIsBumping(false);
        }, 350);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isEnabled, petType, isRunning, isSleeping]);

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
      className="fixed bottom-2 z-40 pointer-events-none transition-[left] duration-75 ease-linear"
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
          direction={facingDirection}
          isHappy={isHappy}
          isBumping={isBumping}
        />
      </div>
    </div>
  );
};
