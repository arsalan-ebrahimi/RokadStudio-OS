import React, { useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  Layers,
  BarChart3,
  Calendar,
  Users,
  FileText,
  Shield,
} from 'lucide-react';
import { useScrum } from '../hooks/use-scrum';
import { SCRUM_COLOR_MAP } from '../types/scrum-types';
import { SprintsTab } from '../components/SprintsTab';
import { KpiTab } from '../components/KpiTab';
import { EventsTab } from '../components/EventsTab';
import { MembersTab } from '../components/MembersTab';
import { ScrumReportTab } from '../components/ScrumReportTab';
import { cn } from '@/shared/lib/utils';
import { toPersianDigits } from '@/shared/lib/formatters';

type TabKey = 'sprints' | 'kpis' | 'events' | 'members' | 'report';

export const ScrumDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const scrumId = Number(id);
  const location = useLocation();
  const isPanel = location.pathname.startsWith('/panel');
  const backPath = isPanel ? '/panel/scrums' : '/my-scrums';

  const [activeTab, setActiveTab] = useState<TabKey>('sprints');

  const { data: scrum, isLoading, error } = useScrum(scrumId);

  if (isLoading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/20 animate-spin mx-auto" />
        <p className="text-xs font-bold text-ink-normal/50 dark:text-gray-400">
          در حال بارگذاری اطلاعات اسکرام...
        </p>
      </div>
    );
  }

  if (error || !scrum) {
    return (
      <div className="py-16 text-center space-y-4 max-w-md mx-auto">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 text-rose-500 border border-rose-200 flex items-center justify-center text-2xl font-bold shadow-hard">
          !
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-black text-sec dark:text-white">اسکرام یافت نشد</h3>
          <p className="text-xs text-ink-normal/60 dark:text-gray-400">
            شناسه اسکرام نامعتبر است یا شما دسترسی مشاهده این اسکرام را ندارید.
          </p>
        </div>
        <Link
          to={backPath}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
        >
          <ArrowRight className="w-4 h-4" />
          <span>بازگشت به لیست اسکرام‌ها</span>
        </Link>
      </div>
    );
  }

  const colorMeta = SCRUM_COLOR_MAP[scrum.color] || SCRUM_COLOR_MAP.ECOSYSTEM;
  const canEdit = Boolean(scrum.canEdit);
  const members = scrum.members || [];

  const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: 'sprints', label: 'اسپرینت‌ها', icon: Layers },
    { key: 'kpis', label: 'شاخص‌ها (KPI)', icon: BarChart3 },
    { key: 'events', label: 'ریتم جلسات', icon: Calendar },
    { key: 'members', label: `اعضا (${toPersianDigits(members.length)})`, icon: Users },
    { key: 'report', label: 'گزارش عملکرد', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#121824] border-2 border-primary/25 shadow-hard space-y-4">
        {/* Navigation & Back */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
          <Link
            to={backPath}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-normal/60 dark:text-gray-400 hover:text-primary transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>بازگشت به {isPanel ? 'مدیریت اسکرام‌ها' : 'اسکرام‌های من'}</span>
          </Link>

          {canEdit && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
              <Shield className="w-3.5 h-3.5" />
              <span>دسترسی مدیریت اسکرام</span>
            </span>
          )}
        </div>

        {/* Title & Metadata */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span
                className="w-4 h-4 rounded-full shadow-sm shrink-0"
                style={{ backgroundColor: colorMeta.accent }}
              />
              <h1 className="text-xl sm:text-2xl font-black text-sec dark:text-white">
                {scrum.name}
              </h1>
            </div>
            {scrum.description && (
              <p className="text-xs text-ink-normal/60 dark:text-gray-400 max-w-2xl leading-relaxed">
                {scrum.description}
              </p>
            )}
          </div>

          {/* Member Avatars Stack */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center -space-x-2 space-x-reverse overflow-hidden">
              {members.slice(0, 5).map((m) => (
                <div
                  key={m.id}
                  className="inline-block w-8 h-8 rounded-full ring-2 ring-white dark:ring-[#121824] bg-[#612B89] text-white flex items-center justify-center font-black text-xs shadow-sm"
                  title={m.name}
                >
                  {m.name.slice(0, 1)}
                </div>
              ))}
              {members.length > 5 && (
                <div className="inline-block w-8 h-8 rounded-full ring-2 ring-white dark:ring-[#121824] bg-gray-200 dark:bg-gray-700 text-ink-normal/70 dark:text-gray-300 flex items-center justify-center font-bold text-[10px]">
                  +{toPersianDigits(members.length - 5)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-gray-100 dark:border-gray-800 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap',
                  isActive
                    ? 'bg-primary text-white shadow-hard-sm'
                    : 'text-ink-normal/70 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="pt-1">
        {activeTab === 'sprints' && <SprintsTab scrum={scrum} canEdit={canEdit} />}
        {activeTab === 'kpis' && <KpiTab scrum={scrum} canEdit={canEdit} />}
        {activeTab === 'events' && <EventsTab scrum={scrum} canEdit={canEdit} />}
        {activeTab === 'members' && <MembersTab scrum={scrum} canEdit={canEdit} />}
        {activeTab === 'report' && <ScrumReportTab scrum={scrum} canEdit={canEdit} />}
      </div>
    </div>
  );
};

