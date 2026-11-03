import React from 'react';
import { Coffee } from 'lucide-react';
import { formatSecondsToTime, toPersianDigits } from '@/shared/lib/formatters';

interface BreakOverlayProps {
  remaining: number;
}

export const BreakOverlay: React.FC<BreakOverlayProps> = ({ remaining }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-sm bg-white dark:bg-[#151C28] rounded-3xl border-2 border-girl shadow-female p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-female-light dark:bg-female-darker/60 flex items-center justify-center mx-auto text-girl">
          <Coffee className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-sec dark:text-white">زمان استراحت</h2>
        <p className="text-4xl font-black text-girl tabular-nums" dir="ltr">
          {toPersianDigits(formatSecondsToTime(remaining))}
        </p>
      </div>
    </div>
  );
};
