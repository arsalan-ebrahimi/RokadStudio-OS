import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, ArrowLeft } from 'lucide-react';
import { Badge, Card } from '@/shared/ui';
import { useAuthStore } from '@/features/auth';
import { toPersianDigits } from '@/shared/lib/formatters';
import { useTodayScrumEvents } from '../hooks/use-scrum';
import { SCRUM_COLOR_MAP } from '../types/scrum-types';

export const TodayScrumEventsCard: React.FC = () => {
  const { user } = useAuthStore();
  const hasMemberships = Boolean(user && (user.memberScrumCount ?? 0) > 0);
  const { data: events = [], isLoading, isError } = useTodayScrumEvents({
    enabled: hasMemberships,
  });

  if (!hasMemberships || isLoading || isError || events.length === 0) {
    return null;
  }

  return (
    <Card className="p-4 sm:p-5 rounded-3xl space-y-3.5">
      <div className="flex items-center justify-between pb-2.5 border-b border-sec/10 dark:border-gray-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-ecosystem-light dark:bg-ecosystem-darker/60 text-sec dark:text-primary flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4 text-primary" />
          </div>
          <h3 className="text-xs sm:text-sm font-black text-sec dark:text-white truncate">
            امروز در اسکرام‌ها ({toPersianDigits(events.length)} رویداد)
          </h3>
        </div>

        <Link
          to="/my-scrums"
          className="text-[11px] font-black text-sec dark:text-primary hover:underline flex items-center gap-1 shrink-0"
        >
          <span>مشاهده</span>
          <ArrowLeft className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-2.5">
        {events.map((e) => {
          const colorMeta = SCRUM_COLOR_MAP[e.scrumColor] || SCRUM_COLOR_MAP.ECOSYSTEM;
          return (
            <Link
              key={e.id}
              to={`/my-scrums/${e.scrumId}`}
              className="p-2.5 rounded-2xl border border-sec/15 dark:border-gray-700 bg-[#F8FAFC] dark:bg-[#182030] hover:border-primary hover:bg-white dark:hover:bg-[#1E2738] transition-all flex items-stretch gap-3 group"
            >
              {/* Dedicated Time Column */}
              <div className="w-20 shrink-0 rounded-xl bg-[#ECF7F5] dark:bg-[#182730] border border-primary/25 px-2 py-1.5 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-1 font-mono text-xs font-black text-sec dark:text-white tabular-nums">
                  <Clock className="w-3 h-3 text-primary shrink-0" />
                  <span>{e.startTime ? toPersianDigits(e.startTime) : '—'}</span>
                </div>
                {e.durationMinutes != null && (
                  <span className="text-[10px] font-bold text-sec/60 dark:text-gray-400 tabular-nums mt-0.5">
                    {toPersianDigits(e.durationMinutes)} دقیقه
                  </span>
                )}
              </div>

              {/* Ceremony Details */}
              <div className="min-w-0 flex-1 flex flex-col justify-center gap-1.5">
                <h4 className="text-xs font-black text-sec dark:text-white group-hover:text-primary transition-colors truncate">
                  {e.name}
                </h4>
                <div>
                  <Badge dot variant={colorMeta.badgeVariant} className="text-[10px] py-0.5 px-2">
                    <span className="truncate max-w-[140px]">{e.scrumName}</span>
                  </Badge>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
};
