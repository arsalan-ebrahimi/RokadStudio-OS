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
        className="fixed inset-0 -top-[350px] -bottom-[350px] -left-[150px] -right-[150px] bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
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
            'relative w-full max-w-md my-auto pointer-events-auto bg-white dark:bg-[#151C28] rounded-2xl sm:rounded-3xl border-2 border-primary/40 shadow-hard-lg dark:shadow-dark-hard p-5 sm:p-6 transition-all animate-in zoom-in-95 duration-150',
            className
          )}
        >
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 mb-4">
            {title && <h3 className="text-base font-extrabold text-sec dark:text-white truncate pe-2">{title}</h3>}
            {dismissible && onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                aria-label="بستن"
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
