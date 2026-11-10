import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Eye, FolderKanban, Search, Users, X } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  SegmentedControl,
  Skeleton,
} from '@/shared/ui';
import { useMyProjects } from '@/features/projects';
import { WorkTargetSessionsModal } from '@/features/timer';
import { toPersianDigits } from '@/shared/lib/formatters';
import type { Project } from '@/shared/types/models';

type ProjectStatusFilter = 'ALL' | 'ACTIVE' | 'COMPLETED';

export const UserProjectsPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingProject, setViewingProject] = useState<Project | null>(null);

  const {
    data: projects = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useMyProjects({ includeInactive: true });

  const activeCount = useMemo(
    () => projects.filter((p) => p.isActive !== false).length,
    [projects]
  );
  const completedCount = useMemo(
    () => projects.filter((p) => p.isActive === false).length,
    [projects]
  );

  const filteredProjects = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return projects.filter((p) => {
      const active = p.isActive !== false;
      if (statusFilter === 'ACTIVE' && !active) return false;
      if (statusFilter === 'COMPLETED' && active) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        Boolean(p.description && p.description.toLowerCase().includes(q))
      );
    });
  }, [projects, statusFilter, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sec/15 dark:border-gray-800">
        <div className="space-y-1.5">
          <Link
            to="/app"
            className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 -ms-2.5 rounded-xl text-xs font-bold text-ink-normal/75 dark:text-gray-300 hover:text-sec dark:hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>بازگشت به پیشخوان تایمر</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-ecosystem-light dark:bg-ecosystem-darker/60 border-[1.5px] border-sec/30 dark:border-primary/40 text-sec dark:text-primary flex items-center justify-center shadow-hard-sm shrink-0">
              <FolderKanban className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-sec dark:text-white">
              پروژه‌های من
            </h1>
          </div>

          <p className="text-xs text-ink-normal/65 dark:text-gray-400 leading-relaxed">
            فهرست پروژه‌های استودیو که به شما اختصاص داده شده‌اند؛ روی هر پروژه کلیک کنید تا کارکرد تمام اعضای تیم را بر اساس تاریخ مشاهده کنید.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex items-center w-full sm:max-w-xs">
          <Search className="w-4 h-4 text-sec/45 dark:text-gray-400 absolute start-3 pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجوی نام یا توضیحات پروژه..."
            className="ps-9 pe-8 text-xs"
            containerClassName="w-full"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-sec/50 hover:text-sec dark:hover:text-white absolute end-2 cursor-pointer"
              aria-label="پاک کردن جستجو"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <SegmentedControl<ProjectStatusFilter>
          size="sm"
          value={statusFilter}
          onChange={setStatusFilter}
          aria-label="فیلتر وضعیت پروژه‌های من"
          className="overflow-x-auto no-scrollbar max-w-full shrink-0"
          options={[
            { value: 'ALL', label: `همه (${toPersianDigits(projects.length)})` },
            { value: 'ACTIVE', label: `در حال اجرا (${toPersianDigits(activeCount)})` },
            { value: 'COMPLETED', label: `تمام شده (${toPersianDigits(completedCount)})` },
          ]}
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-3xl" />
            ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="خطا در دریافت پروژه‌های من"
          message={error instanceof Error ? error.message : 'دریافت فهرست پروژه‌ها با خطا مواجه شد.'}
          onRetry={() => refetch()}
        />
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          title="پروژه‌ای یافت نشد"
          description={
            searchTerm || statusFilter !== 'ALL'
              ? 'فیلتر جستجو یا وضعیت را تغییر دهید تا پروژه‌های دیگر نمایش داده شوند.'
              : 'در حال حاضر پروژه‌ای به شما اختصاص داده نشده است.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProjects.map((p) => {
            const isActive = p.isActive !== false;
            return (
              <Card
                key={p.id}
                hoverable
                onClick={() => setViewingProject(p)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setViewingProject(p);
                  }
                }}
                className="p-5 rounded-3xl border-[1.5px] border-sec/20 dark:border-primary/25 flex flex-col justify-between space-y-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <h3 className="text-sm sm:text-base font-black text-sec dark:text-white leading-snug break-words">
                      {p.name}
                    </h3>
                    <Badge dot variant={isActive ? 'ecosystem' : 'neutral'} className="shrink-0">
                      {isActive ? 'در حال اجرا' : 'تمام شده'}
                    </Badge>
                  </div>

                  <p className="text-xs text-ink-normal/65 dark:text-gray-400 line-clamp-2 min-h-[32px] leading-relaxed">
                    {p.description || 'بدون توضیحات'}
                  </p>
                </div>

                <div
                  className="pt-3 border-t border-sec/10 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#F8FAFC] dark:bg-[#182030] border border-sec/15 dark:border-gray-700 text-xs font-bold text-sec dark:text-gray-200 tabular-nums">
                    <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>{toPersianDigits(p.memberCount || 0)} عضو</span>
                  </span>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setViewingProject(p)}
                    className="gap-1.5 border-primary/50 text-sec dark:text-primary hover:bg-primary/15 text-xs font-black"
                  >
                    <Eye className="w-3.5 h-3.5 shrink-0" />
                    <span>مشاهده گزارش کارکرد</span>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Read-only Project Work Logs Modal for Assigned Contributors */}
      <WorkTargetSessionsModal
        isOpen={Boolean(viewingProject)}
        onClose={() => setViewingProject(null)}
        targetKind="PROJECT"
        targetId={viewingProject?.id ?? null}
        initialTitle={viewingProject?.name}
        initialDescription={viewingProject?.description}
      />
    </div>
  );
};

export default UserProjectsPage;

