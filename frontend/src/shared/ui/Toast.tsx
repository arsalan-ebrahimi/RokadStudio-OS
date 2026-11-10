import React from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../lib/utils';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  action?: ToastAction;
  durationMs?: number;
}

interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  action?: ToastAction;
}

interface ToastStore {
  toasts: ToastItem[];
  add: (message: string, type?: ToastItem['type'], options?: ToastOptions) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (message, type = 'info', options) => {
    const id = Math.random().toString(36).substring(2, 9);
    const duration = options?.durationMs ?? (options?.action ? 7000 : 4000);
    set((state) => ({
      toasts: [...state.toasts, { id, type, message, action: options?.action }],
    }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },
  remove: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (msg: string, options?: ToastOptions) => useToastStore.getState().add(msg, 'success', options),
  error: (msg: string, options?: ToastOptions) => useToastStore.getState().add(msg, 'error', options),
  info: (msg: string, options?: ToastOptions) => useToastStore.getState().add(msg, 'info', options),
};

export const ToastContainer: React.FC = () => {
  const { toasts, remove } = useToastStore();
  if (toasts.length === 0) return null;

  return createPortal(
    <div aria-live="polite" className="fixed bottom-4 start-4 z-[99999] pointer-events-none flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-center justify-between gap-2 p-3.5 rounded-xl border shadow-hard-md text-xs sm:text-sm font-bold animate-in slide-in-from-bottom-2',
            t.type === 'success' && 'bg-white dark:bg-[#151C28] text-emerald-600 border-emerald-500 shadow-ecosystem',
            t.type === 'error' && 'bg-white dark:bg-[#151C28] text-[#C60036] border-[#C60036] shadow-female',
            t.type === 'info' && 'bg-white dark:bg-[#151C28] text-sec dark:text-white border-sec dark:border-primary shadow-male'
          )}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {t.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
            {t.type === 'info' && <Info className="w-4 h-4 shrink-0" />}
            <span className="leading-snug">{t.message}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  const fn = t.action?.onClick;
                  remove(t.id);
                  fn?.();
                }}
                className="px-2.5 py-1 rounded-lg bg-current/10 border border-current/25 text-[11px] font-black hover:opacity-85 transition-opacity cursor-pointer"
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => remove(t.id)}
              className="p-1.5 -me-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg text-current opacity-80 hover:opacity-100 transition-all cursor-pointer"
              aria-label="بستن پیام"
              title="بستن"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>,
    document.body
  );
};

