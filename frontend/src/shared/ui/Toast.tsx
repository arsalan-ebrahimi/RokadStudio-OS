import React from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastStore {
  toasts: ToastItem[];
  add: (message: string, type?: ToastItem['type']) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (message, type = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  remove: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (msg: string) => useToastStore.getState().add(msg, 'success'),
  error: (msg: string) => useToastStore.getState().add(msg, 'error'),
  info: (msg: string) => useToastStore.getState().add(msg, 'info'),
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
            'pointer-events-auto flex items-center justify-between p-3.5 rounded-xl border shadow-hard-md text-xs sm:text-sm font-bold animate-in slide-in-from-bottom-2',
            t.type === 'success' && 'bg-white dark:bg-[#151C28] text-emerald-600 border-emerald-500 shadow-ecosystem',
            t.type === 'error' && 'bg-white dark:bg-[#151C28] text-[#C60036] border-[#C60036] shadow-female',
            t.type === 'info' && 'bg-white dark:bg-[#151C28] text-sec dark:text-white border-sec dark:border-primary shadow-male'
          )}
        >
          <div className="flex items-center gap-2">
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {t.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
            {t.type === 'info' && <Info className="w-4 h-4 shrink-0" />}
            <span>{t.message}</span>
          </div>
          <button onClick={() => remove(t.id)} className="p-1 hover:opacity-70" aria-label="بستن">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
};

