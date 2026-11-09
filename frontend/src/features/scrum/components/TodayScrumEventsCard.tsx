import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, ArrowLeft } from 'lucide-react';
import { Card } from '@/shared/ui';
import { toPersianDigits } from '@/shared/lib/formatters';
import { useTodayScrumEvents } from '../hooks/use-scrum';
import { SCRUM_COLOR_MAP } from '../types/scrum-types';

export const TodayScrumEventsCard: React.FC = () => {
  const { data: events = [], isLoading } = useTodayScrumEvents();

  if (isLoading || events.length === 0) {
    return null; // Hide card when empty
  }

  return (
    <Card className="p-4 sm:p-5 border-2 border-primary/25 shadow-hard space-y-3 bg-white dark:bg-[#121824]">
      <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="text-xs sm:text-sm font-black text-sec dark:text-white">
            امروز در اسکرام‌ها ({toPersianDigits(events.length)} رویداد)
          </h3>
        </div>

        <Link
          to="/my-scrums"
          className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
        >
          <span>مشاهده اسکرام‌ها</span>
          <ArrowLeft className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-2">
        {events.map((e) => {
          const colorMeta = SCRUM_COLOR_MAP[e.scrumColor] || SCRUM_COLOR_MAP.ECOSYSTEM;
          return (
            <Link
              key={e.id}
              to={`/my-scrums/${e.scrumId}`}
              className="p-2.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-[#182030] hover:border-primary/40 transition-all flex items-center justify-between gap-3 group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: colorMeta.accent }}
                />
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-sec dark:text-white group-hover:text-primary transition-colors truncate">
                    {e.name}
                  </h4>
                  <span className="text-[10px] text-ink-normal/50 dark:text-gray-400 font-bold">
                    {e.scrumName}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 text-[11px] font-bold text-ink-normal/70 dark:text-gray-300">
                {e.startTime && (
                  <div className="flex items-center gap-1 font-mono text-primary font-black">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{toPersianDigits(e.startTime)}</span>
                  </div>
                )}
                {e.durationMinutes && (
                  <span className="text-[10px] text-gray-400">
                    ({toPersianDigits(e.durationMinutes)} دقیقه)
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
};

