import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: string;
  dismissible?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  dismissible = true,
  children,
  className,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible && onClose) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, dismissible, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto"
    >
      <div
        className={cn(
          'relative w-full max-w-md max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col bg-white dark:bg-[#151C28] rounded-2xl sm:rounded-3xl border-2 border-primary/40 shadow-hard-lg dark:shadow-dark-hard p-4 sm:p-6 overflow-visible',
          className
        )}
      >
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 mb-4 shrink-0">
          {title && <h3 className="text-sm sm:text-base font-extrabold text-sec dark:text-white truncate pe-2">{title}</h3>}
          {dismissible && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors shrink-0"
              aria-label="بستن"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="overflow-y-auto -mx-1 px-1">
          {children}
        </div>
      </div>
    </div>
  );
};

