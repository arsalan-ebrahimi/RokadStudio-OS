import React, { useEffect, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  Layers,
  FolderKanban,
  BarChart3,
  Calendar,
  Users,
  Trophy,
  FileText,
  Edit2,
  Shield,
} from 'lucide-react';
import {
  Button,
  Badge,
  Skeleton,
  ErrorState,
  AvatarStack,
} from '@/shared/ui';
import { useScrum, useScrumLeaderboard } from '../hooks/use-scrum';
import { SCRUM_COLOR_MAP } from '../types/scrum-types';
import { SprintsTab } from '../components/SprintsTab';
import { ProjectsTab } from '../components/ProjectsTab';
import { KpiTab } from '../components/KpiTab';
import { EventsTab } from '../components/EventsTab';
import { MembersTab } from '../components/MembersTab';
import { LeaderboardTab } from '../components/LeaderboardTab';
import { ScrumReportTab } from '../components/ScrumReportTab';
import { EditScrumModal } from '../components/EditScrumModal';
import { ManageScrumAdminsModal } from '../components/ManageScrumAdminsModal';
import { cn } from '@/shared/lib/utils';
import { toPersianDigits } from '@/shared/lib/formatters';

type TabKey =
  | 'sprints'
  | 'projects'
  | 'kpi'
  | 'events'
  | 'members'
  | 'leaderboard'
  | 'report';

const VALID_TABS: readonly TabKey[] = [
  'sprints',
  'projects',
  'kpi',
  'events',
  'members',
  'leaderboard',
  'report',
];

function parseTabHash(hash: string): TabKey {
  const clean = hash.replace(/^#/, '').trim();
  if ((VALID_TABS as readonly string[]).includes(clean)) {
    return clean as TabKey;
  }
  return 'sprints';
}

export const ScrumDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const scrumId = Number(id);
  const isValidId = Number.isInteger(scrumId) && scrumId > 0;

  const location = useLocation();
  const isPanel = location.pathname.startsWith('/panel');
  const isScrumAdminArea = location.pathname.startsWith('/scrum-admin');
  const backPath = isPanel
    ? '/panel/scrums'
    : isScrumAdminArea
      ? '/scrum-admin/scrums'
      : '/my-scrums';
  const backLabel = isPanel ? 'مدیریت اسکرام‌ها' : 'اسکرام‌های من';

  const [activeTab, setActiveTab] = useState<TabKey>(() =>
    parseTabHash(typeof window !== 'undefined' ? window.location.hash : '')
  );
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [adminsModalOpen, setAdminsModalOpen] = useState(false);

  const {
    data: scrum,
    isLoading,
    isError,
    error,
    refetch,
  } = useScrum(isValidId ? scrumId : 0);

  const { data: headerLeaderboard } = useScrumLeaderboard(
    isValidId ? scrumId : 0,
    { period: 'SPRINT' },
    { enabled: Boolean(isValidId && scrum) }
  );

  // Sync URL hash <-> tab state (deep-link & hashchange support)
  useEffect(() => {
    setActiveTab(parseTabHash(window.location.hash));
  }, [scrumId, location.hash]);

  useEffect(() => {
    const onHashChange = () => {
      setActiveTab(parseTabHash(window.location.hash));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const selectTab = (tab: TabKey) => {
    setActiveTab(tab);
    const nextUrl = `${location.pathname}${location.search}#${tab}`;
    window.history.replaceState(null, '', nextUrl);
  };

  if (!isValidId) {
    return (
      <div className="space-y-4">
        <Link
          to={backPath}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-normal/60 dark:text-gray-400 hover:text-primary transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          <span>بازگشت به {backLabel}</span>
        </Link>
        <ErrorState
          title="شناسه اسکرام نامعتبر است"
          message="آدرس صفحه‌ای که وارد کرده‌اید معتبر نیست."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#121824] border-2 border-primary/20 shadow-hard space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-7 w-28 rounded-full" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <Skeleton className="h-9 w-36" />
          </div>
          <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            {Array(6)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-9 w-24 rounded-xl" />
              ))}
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !scrum) {
    return (
      <div className="space-y-4 max-w-lg mx-auto py-8">
        <ErrorState
          title="خطا در دریافت اطلاعات اسکرام"
          message={
            error instanceof Error
              ? error.message
              : 'اسکرام یافت نشد یا شما دسترسی مشاهده آن را ندارید.'
          }
          onRetry={() => refetch()}
        />
        <div className="text-center">
          <Link
            to={backPath}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
          >
            <ArrowRight className="w-4 h-4" />
            <span>بازگشت به {backLabel}</span>
          </Link>
        </div>
      </div>
    );
  }

  const colorMeta = SCRUM_COLOR_MAP[scrum.color] || SCRUM_COLOR_MAP.ECOSYSTEM;
  const canEditContent = scrum.permissions?.canEditContent ?? Boolean(scrum.canEdit);
  const canManageAdmins = Boolean(scrum.permissions?.canManageAdmins);
  const admins = scrum.admins || [];
  const members = scrum.members || [];
  const myRank = headerLeaderboard?.me?.rank ?? null;

  const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: 'sprints', label: 'اسپرینت‌ها', icon: Layers },
    { key: 'projects', label: 'پروژه‌ها', icon: FolderKanban },
    { key: 'kpi', label: 'KPI', icon: BarChart3 },
    { key: 'events', label: 'ریتم جلسات', icon: Calendar },
    { key: 'members', label: `اعضا (${toPersianDigits(members.length)})`, icon: Users },
    { key: 'leaderboard', label: 'رتبه‌بندی', icon: Trophy },
    { key: 'report', label: 'گزارش', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="rounded-3xl bg-white dark:bg-[#121824] border-[1.5px] border-sec/25 dark:border-primary/35 shadow-hard overflow-hidden">
        {/* Top Accent Band */}
        <div className={cn('h-2 w-full', colorMeta.solidBg)} />

        <div className="p-5 sm:p-6 space-y-4">
          {/* Navigation, Status & Server-driven Action Chips */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-sec/10 dark:border-gray-800">
            <Link
              to={backPath}
              className="inline-flex items-center gap-1.5 min-h-[38px] px-2.5 -ms-2.5 rounded-xl text-xs font-bold text-ink-normal/75 dark:text-gray-300 hover:text-sec dark:hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              <span>بازگشت به {backLabel}</span>
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <Badge dot variant={scrum.isActive ? 'ecosystem' : 'neutral'}>
                {scrum.isActive ? 'فعال' : 'بایگانی'}
              </Badge>

              {myRank != null && (
                <button
                  type="button"
                  onClick={() => selectTab('leaderboard')}
                  className="inline-flex items-center gap-1.5 min-h-[38px] text-xs font-black px-3 py-1 rounded-full bg-college-light dark:bg-amber-950/50 text-[#704A0D] dark:text-amber-200 border border-college-normal/45 hover:bg-college-normal/20 transition-colors cursor-pointer tabular-nums"
                >
                  <Trophy className="w-3.5 h-3.5 shrink-0" />
                  <span>رتبه من: {toPersianDigits(myRank)}</span>
                </button>
              )}

              {canEditContent && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditModalOpen(true)}
                  className="gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5 text-sec dark:text-primary" />
                  <span>ویرایش</span>
                </Button>
              )}

              {canManageAdmins && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAdminsModalOpen(true)}
                  className="gap-1.5"
                >
                  <Shield className="w-3.5 h-3.5 text-sec dark:text-primary" />
                  <span>مدیریت ادمین‌ها</span>
                </Button>
              )}
            </div>
          </div>

          {/* Title, Description & Avatar Stacks */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2.5">
                <span className={cn('w-4 h-4 rounded-full border border-sec/30 shadow-sm shrink-0', colorMeta.solidBg)} />
                <h1 className="text-xl sm:text-2xl font-black text-sec dark:text-white truncate">
                  {scrum.name}
                </h1>
              </div>
              {scrum.description && (
                <p className="text-xs text-ink-normal/65 dark:text-gray-400 max-w-2xl leading-relaxed">
                  {scrum.description}
                </p>
              )}
            </div>

            {/* Admins & Members Avatars Stack */}
            <div className="flex flex-wrap items-center gap-4 shrink-0">
              {admins.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-ink-normal/60 dark:text-gray-400">
                    ادمین‌ها:
                  </span>
                  <AvatarStack
                    users={admins}
                    max={3}
                    size="sm"
                    avatarClassName="bg-[#612B89] text-white"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-ink-normal/60 dark:text-gray-400">
                  اعضا:
                </span>
                <AvatarStack
                  users={members}
                  max={5}
                  size="sm"
                  emptyLabel="بدون عضو"
                />
              </div>
            </div>
          </div>

          {/* Tabs Bar */}
          <div className="pt-3 border-t border-sec/10 dark:border-gray-800">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none px-0.5 py-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => selectTab(tab.key)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'min-h-[44px] flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer whitespace-nowrap shrink-0 border-[1.5px]',
                      isActive
                        ? 'bg-primary text-sec border-sec shadow-[2px_2px_0_#202A5A]'
                        : 'text-sec/75 dark:text-gray-300 border-transparent hover:bg-sec/[0.05] dark:hover:bg-gray-800'
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="pt-1">
        {activeTab === 'sprints' && <SprintsTab scrum={scrum} canEdit={canEditContent} />}
        {activeTab === 'projects' && <ProjectsTab scrum={scrum} canEdit={canEditContent} />}
        {activeTab === 'kpi' && <KpiTab scrum={scrum} canEdit={canEditContent} />}
        {activeTab === 'events' && <EventsTab scrum={scrum} canEdit={canEditContent} />}
        {activeTab === 'members' && <MembersTab scrum={scrum} canEdit={canEditContent} />}
        {activeTab === 'leaderboard' && <LeaderboardTab scrum={scrum} />}
        {activeTab === 'report' && <ScrumReportTab scrum={scrum} canEdit={canEditContent} />}
      </div>

      {/* Modals */}
      {editModalOpen && (
        <EditScrumModal
          scrum={scrum}
          onClose={() => setEditModalOpen(false)}
        />
      )}
      {adminsModalOpen && (
        <ManageScrumAdminsModal
          scrum={scrum}
          onClose={() => setAdminsModalOpen(false)}
        />
      )}
    </div>
  );
};
