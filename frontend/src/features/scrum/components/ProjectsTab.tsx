import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Link2,
  FolderKanban,
  Clock,
  MoreVertical,
  Users,
  Unlink,
  Search,
  Check,
  X,
} from 'lucide-react';
import {
  Card,
  Button,
  Input,
  Badge,
  Modal,
  Checkbox,
  Skeleton,
  EmptyState,
  ErrorState,
  ConfirmDialog,
  AvatarStack,
} from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import { toPersianDigits, formatDurationToHoursMins } from '@/shared/lib/formatters';
import {
  useScrumProjects,
  useAvailableScrumProjects,
  useCreateScrumProject,
  useLinkProjectToScrum,
  useUnlinkProjectFromScrum,
  useSyncScrumProjectMembers,
} from '../hooks/use-scrum';
import type { Scrum, ScrumLinkedProject } from '../types/scrum-types';

interface ProjectsTabProps {
  scrum: Scrum;
  canEdit: boolean;
}

export const ProjectsTab: React.FC<ProjectsTabProps> = ({ scrum, canEdit }) => {
  const {
    data: projects = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useScrumProjects(scrum.id);

  const createMut = useCreateScrumProject(scrum.id);
  const linkMut = useLinkProjectToScrum(scrum.id);
  const unlinkMut = useUnlinkProjectFromScrum(scrum.id);
  const syncMembersMut = useSyncScrumProjectMembers(scrum.id);

  const scrumMembers = useMemo(() => scrum.members || [], [scrum]);
  const scrumMemberIds = useMemo(
    () => new Set(scrumMembers.map((m) => m.id)),
    [scrumMembers]
  );

  // Create modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createMemberIds, setCreateMemberIds] = useState<number[]>([]);

  // Link existing modal state
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [availableSearch, setAvailableSearch] = useState('');
  const [linkingProjectId, setLinkingProjectId] = useState<number | null>(null);

  // Card action menu & assignee popover state
  const [openMenuProjectId, setOpenMenuProjectId] = useState<number | null>(null);
  const [assigningProject, setAssigningProject] = useState<ScrumLinkedProject | null>(null);
  const [assignedMemberIds, setAssignedMemberIds] = useState<number[]>([]);
  const [unlinkingProject, setUnlinkingProject] = useState<ScrumLinkedProject | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);

  const {
    data: availableProjects = [],
    isLoading: isAvailableLoading,
    isError: isAvailableError,
    error: availableError,
    refetch: refetchAvailable,
  } = useAvailableScrumProjects(scrum.id, availableSearch, {
    enabled: isLinkOpen && canEdit,
  });

  // Dismiss menu & popover on outside click or Escape
  useEffect(() => {
    if (openMenuProjectId === null && assigningProject === null) return;
    const handleOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpenMenuProjectId(null);
        setAssigningProject(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuProjectId(null);
        setAssigningProject(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [openMenuProjectId, assigningProject]);

  const handleOpenCreate = () => {
    setCreateName('');
    setCreateDesc('');
    setCreateMemberIds([]);
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || createMut.isPending) return;
    await createMut.mutateAsync({
      name: createName.trim(),
      description: createDesc.trim() || undefined,
      memberIds: createMemberIds.length > 0 ? createMemberIds : undefined,
    });
    setIsCreateOpen(false);
    setCreateName('');
    setCreateDesc('');
    setCreateMemberIds([]);
  };

  const handleLinkProject = async (projectId: number) => {
    if (linkMut.isPending) return;
    setLinkingProjectId(projectId);
    try {
      await linkMut.mutateAsync(projectId);
      setIsLinkOpen(false);
      setAvailableSearch('');
    } finally {
      setLinkingProjectId(null);
    }
  };

  const handleOpenAssignPopover = (project: ScrumLinkedProject) => {
    setOpenMenuProjectId(null);
    const currentScrumAssignees = project.members
      .filter((m) => scrumMemberIds.has(m.id))
      .map((m) => m.id);
    setAssignedMemberIds(currentScrumAssignees);
    setAssigningProject(project);
  };

  const handleSaveAssignees = async () => {
    if (!assigningProject || syncMembersMut.isPending) return;
    await syncMembersMut.mutateAsync({
      projectId: assigningProject.id,
      userIds: assignedMemberIds,
    });
    setAssigningProject(null);
  };

  const handleConfirmUnlink = async () => {
    if (!unlinkingProject || unlinkMut.isPending) return;
    await unlinkMut.mutateAsync(unlinkingProject.id);
    setUnlinkingProject(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="خطا در دریافت پروژه‌های اسکرام"
        message={error instanceof Error ? error.message : 'در دریافت اطلاعات مشکلی پیش آمد.'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h3 className="text-base sm:text-lg font-black text-sec dark:text-white">
            پروژه‌های متصل ({toPersianDigits(projects.length)})
          </h3>
          <p className="text-xs text-ink-normal/60 dark:text-gray-400 mt-0.5">
            پروژه‌های استودیو که به این اسکرام متصل هستند؛ زمان‌های ثبت‌شده اعضای هر پروژه در گزارش و رتبه‌بندی این اسکرام محاسبه می‌شود.
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setAvailableSearch('');
                setIsLinkOpen(true);
              }}
              className="gap-1.5 text-xs font-bold shadow-hard-sm"
            >
              <Link2 className="w-3.5 h-3.5 text-primary" />
              <span>اتصال پروژه موجود</span>
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleOpenCreate}
              className="gap-1.5 text-xs font-extrabold shadow-hard-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ پروژه جدید</span>
            </Button>
          </div>
        )}
      </div>

      {/* Empty State */}
      {projects.length === 0 ? (
        <EmptyState
          title="هنوز پروژه‌ای به این اسکرام متصل نیست"
          description={
            canEdit
              ? 'می‌توانید یک پروژه جدید بسازید یا یکی از پروژه‌های فعال استودیو را به این اسکرام متصل کنید.'
              : 'در حال حاضر پروژه‌ای برای این اسکرام ثبت نشده است.'
          }
          action={
            canEdit ? (
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAvailableSearch('');
                    setIsLinkOpen(true);
                  }}
                  className="gap-1.5 text-xs font-bold"
                >
                  <Link2 className="w-3.5 h-3.5 text-primary" />
                  <span>اتصال پروژه موجود</span>
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleOpenCreate}
                  className="gap-1.5 text-xs font-extrabold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ پروژه جدید</span>
                </Button>
              </div>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((proj) => {
            const isMenuOpen = openMenuProjectId === proj.id;
            const isAssignOpen = assigningProject?.id === proj.id;

            return (
              <Card
                key={proj.id}
                className="relative overflow-visible p-5 rounded-3xl border-[1.5px] border-sec/20 dark:border-primary/25 shadow-hard-sm flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Top Title + Status Badge + Editor Menu */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-2xl bg-ecosystem-light dark:bg-ecosystem-darker/60 border border-sec/20 text-sec dark:text-primary flex items-center justify-center shrink-0 mt-0.5">
                        <FolderKanban className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-sec dark:text-white leading-snug break-words">
                          {proj.name}
                        </h4>
                        <div className="mt-1.5">
                          <Badge dot variant={proj.isActive ? 'ecosystem' : 'neutral'}>
                            {proj.isActive ? 'در حال اجرا' : 'تمام شده'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {canEdit && (
                      <div
                        className="relative shrink-0"
                        ref={isMenuOpen || isAssignOpen ? popoverRef : undefined}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setAssigningProject(null);
                            setOpenMenuProjectId(isMenuOpen ? null : proj.id);
                          }}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-sec/70 dark:text-gray-300 hover:bg-sec/[0.06] dark:hover:bg-gray-800 transition-colors cursor-pointer"
                          aria-label={`عملیات پروژه ${proj.name}`}
                          aria-expanded={isMenuOpen}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Action Dropdown */}
                        {isMenuOpen && (
                          <div
                            role="menu"
                            className="absolute end-0 top-full mt-1.5 z-30 w-48 rounded-2xl border-[1.5px] border-sec dark:border-gray-600 bg-white dark:bg-[#151C28] shadow-hard p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => handleOpenAssignPopover(proj)}
                              className="w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold text-start text-sec dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 cursor-pointer"
                            >
                              <Users className="w-4 h-4 text-sec dark:text-primary shrink-0" />
                              <span>تخصیص افراد</span>
                            </button>

                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenMenuProjectId(null);
                                setUnlinkingProject(proj);
                              }}
                              className="w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold text-start text-[#C60036] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                            >
                              <Unlink className="w-4 h-4 shrink-0" />
                              <span>جدا کردن از اسکرام</span>
                            </button>
                          </div>
                        )}

                        {/* Assignee Checklist Popover */}
                        {isAssignOpen && (
                          <div className="absolute end-0 top-full mt-1.5 z-40 w-64 rounded-2xl border-[1.5px] border-sec dark:border-gray-600 bg-white dark:bg-[#151C28] shadow-hard-lg p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-100">
                            <div className="flex items-center justify-between pb-2 border-b border-sec/10 dark:border-gray-800">
                              <span className="text-xs font-black text-sec dark:text-white">
                                تخصیص اعضای اسکرام
                              </span>
                              <button
                                type="button"
                                onClick={() => setAssigningProject(null)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-sec dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                                aria-label="بستن"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            {scrumMembers.length === 0 ? (
                              <p className="text-[11px] font-bold text-ink-normal/60 dark:text-gray-400 text-center py-2">
                                هیچ عضوی در این اسکرام ثبت نشده است. ابتدا از تب اعضا عضو اضافه کنید.
                              </p>
                            ) : (
                              <>
                                <div className="max-h-48 overflow-y-auto space-y-1.5 pe-0.5">
                                  {scrumMembers.map((member) => {
                                    const checked = assignedMemberIds.includes(member.id);
                                    return (
                                      <label
                                        key={member.id}
                                        className={cn(
                                          'min-h-[40px] flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer select-none transition-colors',
                                          checked
                                            ? 'border-sec/40 bg-ecosystem-light/70 dark:bg-ecosystem-darker/50 text-sec dark:text-white'
                                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-ink-normal/80 dark:text-gray-300'
                                        )}
                                      >
                                        <span className="truncate">{member.name}</span>
                                        <Checkbox
                                          checked={checked}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setAssignedMemberIds((prev) => [...prev, member.id]);
                                            } else {
                                              setAssignedMemberIds((prev) =>
                                                prev.filter((uid) => uid !== member.id)
                                              );
                                            }
                                          }}
                                        />
                                      </label>
                                    );
                                  })}
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setAssigningProject(null)}
                                    disabled={syncMembersMut.isPending}
                                    className="flex-1"
                                  >
                                    لغو
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="primary"
                                    isLoading={syncMembersMut.isPending}
                                    onClick={handleSaveAssignees}
                                    className="flex-[2]"
                                  >
                                    ذخیره ({toPersianDigits(assignedMemberIds.length)})
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {proj.description && (
                    <p className="text-xs text-ink-normal/65 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      {proj.description}
                    </p>
                  )}
                </div>

                <div className="space-y-3 pt-3 border-t border-sec/10 dark:border-gray-800">
                  {/* Assignees Avatar Stack */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-ink-normal/60 dark:text-gray-400">
                      اعضای پروژه:
                    </span>
                    <AvatarStack
                      users={proj.members || []}
                      max={4}
                      size="sm"
                      emptyLabel="بدون عضو"
                    />
                  </div>

                  {/* Tracked Seconds: Editors ONLY */}
                  {canEdit && proj.trackedSeconds && (
                    <div className="p-3 rounded-2xl bg-gray-50 dark:bg-[#182030] border border-sec/15 dark:border-gray-700 flex items-center justify-between gap-2 text-xs font-bold">
                      <span className="flex items-center gap-1.5 text-ink-normal/75 dark:text-gray-300">
                        <Clock className="w-3.5 h-3.5 text-sec dark:text-primary shrink-0" />
                        <span>زمان ثبت‌شده:</span>
                      </span>
                      <div className="flex items-center gap-1.5 tabular-nums">
                        <span className="text-sec dark:text-primary font-black">
                          {formatDurationToHoursMins(proj.trackedSeconds.approved)}
                        </span>
                        {proj.trackedSeconds.pending > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-college-light dark:bg-amber-950/60 text-[#704A0D] dark:text-amber-200 border border-college-normal/40">
                            +{formatDurationToHoursMins(proj.trackedSeconds.pending)} در انتظار
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: + پروژه جدید */}
      {canEdit && (
        <Modal
          isOpen={isCreateOpen}
          onClose={() => {
            if (!createMut.isPending) setIsCreateOpen(false);
          }}
          title="ایجاد پروژه جدید در اسکرام"
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <Input
              label="نام پروژه"
              required
              placeholder="مثال: بازطراحی صفحه فرود"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              autoFocus
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-ink-normal/80 dark:text-gray-300">
                توضیحات (اختیاری)
              </label>
              <textarea
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                rows={2}
                placeholder="شرح مختصر پروژه..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#182030] text-xs font-medium text-sec dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-hard-sm"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-ink-normal/80 dark:text-gray-300">
                  تخصیص اعضای اسکرام (اختیاری)
                </label>
                {createMemberIds.length > 0 && (
                  <span className="text-[11px] font-bold text-primary">
                    {toPersianDigits(createMemberIds.length)} نفر
                  </span>
                )}
              </div>

              {scrumMembers.length === 0 ? (
                <p className="p-3 rounded-xl bg-gray-50 dark:bg-[#182030] border border-gray-200 dark:border-gray-700 text-[11px] font-bold text-ink-normal/60 dark:text-gray-400">
                  ابتدا از تب اعضا، نفرات تیم را به این اسکرام اضافه کنید.
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#151C28]">
                  {scrumMembers.map((m) => {
                    const selected = createMemberIds.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className={cn(
                          'flex items-center justify-between px-2.5 py-2 rounded-lg border text-xs font-bold cursor-pointer select-none',
                          selected
                            ? 'border-primary bg-primary/10 text-sec dark:text-white'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C2536] text-ink-normal/80 dark:text-gray-300'
                        )}
                      >
                        <span className="truncate">{m.name}</span>
                        <Checkbox
                          checked={selected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreateMemberIds((prev) => [...prev, m.id]);
                            } else {
                              setCreateMemberIds((prev) => prev.filter((id) => id !== m.id));
                            }
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setIsCreateOpen(false)}
                disabled={createMut.isPending}
              >
                انصراف
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-[2] font-extrabold shadow-hard"
                isLoading={createMut.isPending}
                disabled={createName.trim().length < 2 || createMut.isPending}
              >
                ایجاد پروژه
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: اتصال پروژه موجود */}
      {canEdit && (
        <Modal
          isOpen={isLinkOpen}
          onClose={() => {
            if (!linkMut.isPending) setIsLinkOpen(false);
          }}
          title="اتصال پروژه موجود به اسکرام"
        >
          <div className="space-y-4">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-ink-normal/45 dark:text-gray-400 absolute start-3 pointer-events-none" />
              <Input
                placeholder="جستجوی نام پروژه آزاد..."
                value={availableSearch}
                onChange={(e) => setAvailableSearch(e.target.value)}
                className="ps-9 text-xs"
                autoFocus
              />
            </div>

            {isAvailableLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : isAvailableError ? (
              <ErrorState
                title="خطا در جستجوی پروژه‌های آزاد"
                message={availableError instanceof Error ? availableError.message : undefined}
                onRetry={() => refetchAvailable()}
                className="p-4"
              />
            ) : availableProjects.length === 0 ? (
              <EmptyState
                title="پروژه آزاد و فعالی یافت نشد"
                description="پروژه‌ها زمانی در این فهرست دیده می‌شوند که فعال بوده و به هیچ اسکرام دیگری متصل نباشند."
                className="py-6"
              />
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 pe-1">
                {availableProjects.map((proj) => {
                  const isThisLinking = linkingProjectId === proj.id && linkMut.isPending;
                  return (
                    <div
                      key={proj.id}
                      className="p-3.5 rounded-2xl border-[1.5px] border-sec/15 dark:border-gray-700 bg-gray-50/80 dark:bg-[#182030] flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <h4 className="text-xs sm:text-sm font-black text-sec dark:text-white truncate">
                          {proj.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-ink-normal/65 dark:text-gray-400 font-bold">
                          <span className="tabular-nums">{toPersianDigits(proj.memberCount)} عضو</span>
                          {proj.description && (
                            <span className="truncate max-w-[180px]">· {proj.description}</span>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        isLoading={isThisLinking}
                        disabled={linkMut.isPending}
                        onClick={() => handleLinkProject(proj.id)}
                        className="shrink-0 gap-1"
                      >
                        {!isThisLinking && <Check className="w-3.5 h-3.5" />}
                        <span>اتصال</span>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Unlink Confirm */}
      <ConfirmDialog
        isOpen={Boolean(unlinkingProject)}
        title="جدا کردن پروژه از اسکرام"
        message={`آیا از جدا کردن پروژه «${unlinkingProject?.name}» از این اسکرام اطمینان دارید؟ سشن‌های کاری قبلی و اعضای پروژه حفظ می‌شوند اما این پروژه دیگر در تب پروژه‌ها و رتبه‌بندی این اسکرام قرار نمی‌گیرد.`}
        confirmLabel="جدا کردن"
        variant="danger"
        isLoading={unlinkMut.isPending}
        onConfirm={handleConfirmUnlink}
        onCancel={() => {
          if (!unlinkMut.isPending) setUnlinkingProject(null);
        }}
      />
    </div>
  );
};
