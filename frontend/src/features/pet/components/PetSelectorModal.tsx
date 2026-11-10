import React from 'react';
import { Modal, Button } from '@/shared/ui';
import { usePetStore, type PetType } from '../hooks/use-pet-store';
import { PetCharacter } from './PetCharacter';
import { cn } from '@/shared/lib/utils';
import { Check } from 'lucide-react';

interface PetSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PetOption {
  type: PetType;
  name: string;
}

const PET_OPTIONS: PetOption[] = [
  { type: 'cat', name: 'پیشی' },
  { type: 'dog', name: 'هاپو' },
  { type: 'robot', name: 'ربات' },
  { type: 'duck', name: 'اردک' },
  { type: 'ghost', name: 'روح' },
];

export const PetSelectorModal: React.FC<PetSelectorModalProps> = ({ isOpen, onClose }) => {
  const { petType, setPetType, isEnabled } = usePetStore();

  const handleSelect = (type: PetType) => {
    setPetType(type);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="همراه تمرکز">
      <div className="space-y-4">
        {/* Pets Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PET_OPTIONS.map((opt) => {
            const isSelected = isEnabled && petType === opt.type;
            return (
              <button
                key={opt.type}
                type="button"
                onClick={() => handleSelect(opt.type)}
                className={cn(
                  'p-3.5 rounded-2xl border-[1.5px] flex flex-col items-center justify-between gap-2 transition-all cursor-pointer relative',
                  isSelected
                    ? 'border-sec dark:border-primary bg-ecosystem-light/60 dark:bg-ecosystem-darker/40 shadow-[2px_2px_0_#202A5A] dark:shadow-[2px_2px_0_#59BBAF]'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C2536] hover:border-gray-300 dark:hover:border-gray-600'
                )}
              >
                {isSelected && (
                  <span className="absolute top-2 start-2 w-5 h-5 rounded-full bg-primary text-sec border border-sec/30 flex items-center justify-center">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                )}
                <div className="h-12 flex items-center justify-center">
                  <PetCharacter type={opt.type} direction="right" isHappy={isSelected} />
                </div>
                <span className="text-xs font-bold text-sec dark:text-white">{opt.name}</span>
              </button>
            );
          })}

          {/* Option: Disable */}
          <button
            type="button"
            onClick={() => handleSelect('none')}
            className={cn(
              'p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer',
              !isEnabled || petType === 'none'
                ? 'border-primary bg-primary/10 dark:bg-primary/15 shadow-[2px_2px_0_#202A5A] dark:shadow-[2px_2px_0_#59BBAF]'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C2536] hover:border-gray-300 dark:hover:border-gray-600'
            )}
          >
            <span className="text-2xl opacity-60">🚫</span>
            <span className="text-xs font-bold text-ink-normal/60 dark:text-gray-400">غیرفعال</span>
          </button>
        </div>

        <Button variant="primary" className="w-full mt-2" onClick={onClose}>
          تایید
        </Button>
      </div>
    </Modal>
  );
};
