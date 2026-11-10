import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
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

    // Dynamically tint iOS Safari status bar and Dynamic Island to pitch black
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    const originalThemeColor = metaThemeColor?.getAttribute('content') || '#202A5A';
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', '#000000');
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible && onClose) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', originalThemeColor);
      }
    };
  }, [isOpen, dismissible, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto overscroll-none"
    >
      {/*
        Full-bleed fixed backdrop covering past all screen boundaries,
        including iOS Dynamic Island, Notch, and Home Indicator bar
      */}
      <div
        className="fixed inset-0 -top-[350px] -bottom-[350px] -left-[150px] -right-[150px] bg-black/75 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        aria-hidden="true"
        onClick={dismissible ? onClose : undefined}
      />

      {/* Centering scrollable container with safe-area padding */}
      <div
        className="relative min-h-[100dvh] min-h-screen flex items-center justify-center p-3 sm:p-4 pointer-events-none"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
        }}
      >
        <div
          className={cn(
            'relative w-full max-w-md my-auto pointer-events-auto bg-white dark:bg-[#151C28] rounded-3xl border-[1.5px] border-sec dark:border-primary/45 shadow-hard-lg dark:shadow-dark-hard p-5 sm:p-6 transition-all animate-in zoom-in-95 duration-150',
            className
          )}
        >
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-sec/10 dark:border-gray-800 mb-4">
            {title && (
              <h3 className="text-base sm:text-lg font-black text-sec dark:text-white truncate pe-2">
                {title}
              </h3>
            )}
            {dismissible && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 -me-2 flex items-center justify-center rounded-xl text-sec/60 dark:text-gray-400 hover:text-sec dark:hover:text-white hover:bg-sec/[0.06] dark:hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                aria-label="بستن"
                title="بستن"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
