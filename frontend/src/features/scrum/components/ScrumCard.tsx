import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Layers, ArrowLeft } from 'lucide-react';
import { Card } from '@/shared/ui';
import { toPersianDigits } from '@/shared/lib/formatters';
import { SCRUM_COLOR_MAP, type Scrum } from '../types/scrum-types';

interface ScrumCardProps {
  scrum: Scrum;
  basePath?: string; // '/panel/scrums' or '/my-scrums'
}

export const ScrumCard: React.FC<ScrumCardProps> = ({ scrum, basePath = '/panel/scrums' }) => {
  const colorMeta = SCRUM_COLOR_MAP[scrum.color] || SCRUM_COLOR_MAP.ECOSYSTEM;

  return (
    <Link to={`${basePath}/${scrum.id}`} className="block group">
      <Card className="h-full relative overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-hard-lg border-2 border-primary/25 p-5 flex flex-col justify-between">
        {/* Top Color Band */}
        <div
          className="absolute top-0 inset-x-0 h-2.5"
          style={{ backgroundColor: colorMeta.accent }}
        />

        <div className="space-y-3 mt-1">
          {/* Header & Status */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: colorMeta.accent }}
                />
                <h3 className="text-base font-black text-sec dark:text-white group-hover:text-primary transition-colors">
                  {scrum.name}
                </h3>
              </div>
              {scrum.description && (
                <p className="text-xs text-ink-normal/60 dark:text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                  {scrum.description}
                </p>
              )}
            </div>

            {!scrum.isActive && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                آرشیو
              </span>
            )}
          </div>

          {/* Active Sprint Pill */}
          <div className="pt-2 flex items-center gap-2 text-xs font-bold text-ink-normal/70 dark:text-gray-300">
            <Layers className="w-4 h-4 text-primary shrink-0" />
            {scrum.activeSprint ? (
              <span className="truncate">
                <span className="font-mono text-primary font-black ml-1">
                  S{toPersianDigits(scrum.activeSprint.number)}
                </span>
                <span>· {scrum.activeSprint.title}</span>
              </span>
            ) : (
              <span className="text-ink-normal/40 dark:text-gray-500">بدون اسپرینت فعال</span>
            )}
          </div>
        </div>

        {/* Footer Meta */}
        <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs font-bold text-ink-normal/60 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-ink-normal/40 dark:text-gray-500" />
            <span>{toPersianDigits(scrum.memberCount || 0)} عضو</span>
          </div>

          <div className="flex items-center gap-1 text-primary group-hover:-translate-x-1 transition-transform">
            <span>مشاهده اسکرام</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </div>
        </div>
      </Card>
    </Link>
  );
};

