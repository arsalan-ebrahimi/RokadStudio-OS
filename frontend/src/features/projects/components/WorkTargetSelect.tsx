import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Lock,
  ChevronDown,
  Clock,
  Zap,
  FolderKanban,
  Search,
  Check,
  X,
} from 'lucide-react';
import { ErrorState } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import { useAuthStore } from '@/features/auth';
import { useWorkTargetsMine } from '@/features/scrum/hooks/use-scrum';
import { SCRUM_COLOR_MAP, type ScrumColor } from '@/features/scrum/types/scrum-types';
import type { TimerTarget } from '@/features/timer/lib/timer-engine';
import { toPersianDigits } from '@/shared/lib/formatters';

interface WorkTargetSelectProps {
  selectedTarget: TimerTarget | null;
  onSelect: (target: TimerTarget) => void;
  isLocked?: boolean;
  variant?: 'default' | 'chip';
}

export const WorkTargetSelect: React.FC<WorkTargetSelectProps> = ({
  selectedTarget,
  onSelect,
  isLocked = false,
  variant = 'default',
}) => {
  const { user } = useAuthStore();
  const userId = user?.id || 'guest';
  const {
    data: targetsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useWorkTargetsMine();

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  const recentTargets = useMemo<TimerTarget[]>(() => {
    const map = new Map<string, TimerTarget>();

    try {
      const raw = localStorage.getItem(`rokad_recent_targets_${userId}`);
      if (raw) {
        const parsed: unknown[] = JSON.parse(raw);
        for (const item of parsed) {
          if (!item || typeof item !== 'object') continue;
          const obj = item as Record<string, unknown>;
          const normalizedKind = obj.kind === 'STUDIO' ? 'PROJECT' : obj.kind;
          if ((normalizedKind === 'PROJECT' || normalizedKind === 'TASK') && typeof obj.id === 'number') {
            map.set(`${normalizedKind}_${obj.id}`, {
              kind: normalizedKind,
              id: obj.id,
              label: String(obj.label || ''),
              points: typeof obj.points === 'number' ? obj.points : undefined,
              scrumColor: typeof obj.scrumColor === 'string' ? obj.scrumColor : undefined,
            });
          }
        }
      }
    } catch {
      // Ignore invalid localStorage payload
    }

    if (targetsData?.recent) {
      for (const r of targetsData.recent) {
        if (r.kind !== 'PROJECT' && r.kind !== 'TASK') continue;
        const key = `${r.kind}_${r.id}`;
        if (!map.has(key)) {
          map.set(key, {
            kind: r.kind,
            id: r.id,
            label: r.pathLabel || r.name,
            points: r.points,
            scrumColor: r.scrum?.color,
          });
        }
      }
    }

    return Array.from(map.values()).slice(0, 3);
  }, [userId, targetsData]);

  const filteredActiveScrums = useMemo(() => {
    if (!targetsData?.scrums) return [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return targetsData.scrums.filter((s) => (s.tasks?.length || 0) > 0);

    return targetsData.scrums
      .map((s) => {
        const scrumMatched = s.scrum.name.toLowerCase().includes(term);
        const tasks = s.tasks || [];
        if (scrumMatched) {
          return { ...s, tasks };
        }
        return {
          ...s,
          tasks: tasks.filter((t) => t.name.toLowerCase().includes(term)),
        };
      })
      .filter((s) => s.tasks.length > 0);
  }, [targetsData, searchTerm]);

  const filteredStudioProjects = useMemo(() => {
    if (!targetsData?.studioProjects) return [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return targetsData.studioProjects;

    return targetsData.studioProjects.filter((p) =>
      p.name.toLowerCase().includes(term)
    );
  }, [targetsData, searchTerm]);

  const totalScrumTargets = useMemo(() => {
    return (targetsData?.scrums || []).reduce(
      (acc, s) => acc + (s.tasks?.length || 0),
      0
    );
  }, [targetsData?.scrums]);

  const handleSelect = (target: TimerTarget) => {
    onSelect(target);
    setIsOpen(false);
    setSearchTerm('');
  };

  const renderSelectedDisplay = (isChipMode: boolean) => {
    if (!selectedTarget) {
      return (
        <span className="text-sec/60 dark:text-gray-400 text-xs font-bold truncate">
          {isLoading
            ? 'در حال بارگذاری اهداف...'
            : isError
              ? 'خطا در بارگذاری اهداف (تلاش مجدد)'
              : isChipMode
                ? 'انتخاب پروژه / هدف کاری'
                : 'انتخاب هدف کاری (اسکرام یا پروژه استودیو)...'}
        </span>
      );
    }

    const match = selectedTarget.label.match(/^\[(.*?)\]\s*(.*)$/);
    const prefix = match ? match[1] : null;
    const title = match ? match[2] : selectedTarget.label;
    const colorMeta = selectedTarget.scrumColor
      ? SCRUM_COLOR_MAP[selectedTarget.scrumColor as ScrumColor]
      : null;

    return (
      <div className="flex items-center gap-2 min-w-0">
        {prefix && colorMeta ? (
          <span
            className={cn(
              'px-2 py-0.5 rounded-full border text-[10px] font-black shrink-0 inline-flex items-center gap-1',
              colorMeta.chipBg,
              colorMeta.text,
              colorMeta.border
            )}
          >
            <span className={cn('w-2 h-2 rounded-full', colorMeta.solidBg)} />
            <span className="max-w-[110px] truncate">{prefix}</span>
          </span>
        ) : (
          <FolderKanban className="w-4 h-4 text-primary shrink-0" />
        )}
        <span className="text-xs sm:text-sm font-extrabold text-sec dark:text-white truncate">
          {title}
        </span>
        {selectedTarget.kind === 'TASK' && typeof selectedTarget.points === 'number' && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-sec/[0.06] dark:bg-gray-800 text-sec/70 dark:text-gray-300 font-bold shrink-0 tabular-nums">
            {toPersianDigits(selectedTarget.points)} پوینت
          </span>
        )}
      </div>
    );
  };

  const dropdownMenu = isOpen && !isLocked && (
    <div
      className={cn(
        'absolute top-full z-50 mt-2 bg-white dark:bg-[#151C28] rounded-3xl border-[1.5px] border-sec dark:border-primary/45 shadow-male dark:shadow-ecosystem overflow-hidden animate-in fade-in zoom-in-95 duration-100',
        variant === 'chip'
          ? 'left-1/2 -translate-x-1/2 w-[min(calc(100vw-2rem),380px)]'
          : 'start-0 end-0'
      )}
    >
      {isError ? (
        <div className="p-2">
          <ErrorState
            compact
            title="خطا در دریافت اهداف کاری"
            message={error instanceof Error ? error.message : 'لطفاً دوباره تلاش کنید.'}
            onRetry={() => refetch()}
          />
        </div>
      ) : (
        <>
          <div className="p-3 border-b border-sec/10 dark:border-gray-800 flex items-center gap-2">
            <Search className="w-4 h-4 text-sec/45 dark:text-gray-400 shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجو در وظایف و پروژه‌ها..."
              autoFocus
              className="w-full bg-transparent text-xs font-bold text-sec dark:text-white placeholder:text-ink-normal/40 dark:placeholder:text-gray-500 focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-sec/50 hover:text-sec dark:hover:text-white cursor-pointer"
                aria-label="پاک کردن جستجو"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto p-2.5 space-y-3.5 text-start">
            {!searchTerm && recentTargets.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 px-2 text-[11px] font-black text-sec/60 dark:text-gray-400">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span>اخیراً استفاده‌شده</span>
                </div>
                <div className="space-y-1">
                  {recentTargets.map((rt) => {
                    const isSelected =
                      selectedTarget?.kind === rt.kind && selectedTarget?.id === rt.id;
                    return (
                      <button
                        key={`recent_${rt.kind}_${rt.id}`}
                        type="button"
                        onClick={() => handleSelect(rt)}
                        className={cn(
                          'w-full min-h-[40px] flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-start text-xs transition-colors cursor-pointer',
                          isSelected
                            ? 'bg-primary text-sec font-black shadow-hard-sm'
                            : 'hover:bg-sec/[0.05] dark:hover:bg-gray-800 text-sec dark:text-gray-200 font-bold'
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {rt.kind === 'TASK' ? (
                            <Zap className="w-3.5 h-3.5 text-college-normal shrink-0" />
                          ) : (
                            <FolderKanban
                              className={cn(
                                'w-3.5 h-3.5 shrink-0',
                                isSelected ? 'text-sec' : 'text-primary'
                              )}
                            />
                          )}
                          <span className="truncate">{rt.label}</span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-sec shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 px-2 text-[11px] font-black text-sec/60 dark:text-gray-400">
                <Zap className="w-3.5 h-3.5 text-college-normal" />
                <span>تسک‌های اسکرام من</span>
              </div>

              {totalScrumTargets === 0 ? (
                <div className="px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-sec/10 dark:border-gray-800 text-center">
                  <p className="text-[11px] text-sec/60 dark:text-gray-400 font-bold">
                    تسک فعالی در اسکرام‌ها به شما اختصاص نیافته است.
                  </p>
                </div>
              ) : filteredActiveScrums.length === 0 ? (
                <p className="px-3 py-2 text-[11px] text-sec/50 font-bold">
                  موردی یافت نشد.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {filteredActiveScrums.map((s) => {
                    const colorMeta = SCRUM_COLOR_MAP[s.scrum.color] || SCRUM_COLOR_MAP.ECOSYSTEM;
                    const scrumTasks = s.tasks || [];

                    return (
                      <div
                        key={`scrum_${s.scrum.id}_${s.sprint?.id ?? 'none'}`}
                        className="rounded-2xl border border-sec/15 dark:border-gray-700 p-2 space-y-2 bg-[#F8F9FA] dark:bg-gray-800/40"
                      >
                        <div className="flex items-center gap-2 px-1.5 py-0.5 text-xs font-black">
                          <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', colorMeta.solidBg)} />
                          <span className="text-sec dark:text-white truncate">{s.scrum.name}</span>
                          {s.sprint && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-primary/15 text-sec dark:text-primary font-bold">
                              S{toPersianDigits(s.sprint.number)}
                            </span>
                          )}
                        </div>

                        {scrumTasks.length > 0 && (
                          <div className="space-y-1">
                            {scrumTasks.map((task) => {
                              const isSelected =
                                selectedTarget?.kind === 'TASK' &&
                                selectedTarget?.id === task.id;
                              const fullLabel = `[${s.scrum.name}] ${task.name}`;

                              return (
                                <button
                                  key={`task_${task.id}`}
                                  type="button"
                                  onClick={() =>
                                    handleSelect({
                                      kind: 'TASK',
                                      id: task.id,
                                      label: fullLabel,
                                      points: task.points,
                                      scrumColor: s.scrum.color,
                                    })
                                  }
                                  className={cn(
                                    'w-full min-h-[38px] flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-start text-xs transition-colors cursor-pointer',
                                    isSelected
                                      ? 'bg-primary text-sec font-black shadow-hard-sm'
                                      : 'hover:bg-white dark:hover:bg-gray-700 text-sec dark:text-gray-200 font-bold'
                                  )}
                                >
                                  <span className="truncate min-w-0">{task.name}</span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span
                                      className={cn(
                                        'text-[10px] px-1.5 py-0.5 rounded font-bold tabular-nums',
                                        isSelected
                                          ? 'bg-sec/15 text-sec'
                                          : 'bg-sec/[0.07] dark:bg-gray-700 text-sec/70 dark:text-gray-300'
                                      )}
                                    >
                                      {toPersianDigits(task.points)} پوینت
                                    </span>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-sec" />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-1.5 pt-2 border-t border-sec/10 dark:border-gray-800">
              <div className="flex items-center gap-1.5 px-2 text-[11px] font-black text-sec/60 dark:text-gray-400">
                <FolderKanban className="w-3.5 h-3.5 text-primary" />
                <span>پروژه‌های استودیو</span>
              </div>

              {filteredStudioProjects.length === 0 ? (
                <p className="px-3 py-2 text-[11px] text-sec/50 font-bold">
                  پروژه‌ای اختصاص نیافته است.
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredStudioProjects.map((p) => {
                    const isSelected =
                      selectedTarget?.kind === 'PROJECT' &&
                      selectedTarget?.id === p.id;
                    return (
                      <button
                        key={`studio_${p.id}`}
                        type="button"
                        onClick={() =>
                          handleSelect({
                            kind: 'PROJECT',
                            id: p.id,
                            label: p.name,
                          })
                        }
                        className={cn(
                          'w-full min-h-[40px] flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-start text-xs transition-colors cursor-pointer',
                          isSelected
                            ? 'bg-primary text-sec font-black shadow-hard-sm'
                            : 'hover:bg-sec/[0.05] dark:hover:bg-gray-800 text-sec dark:text-gray-200 font-bold'
                        )}
                      >
                        <span className="truncate">{p.name}</span>
                        {isSelected && <Check className="w-4 h-4 text-sec shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );

  if (variant === 'chip') {
    return (
      <div className="relative inline-flex max-w-full justify-center" ref={containerRef}>
        <button
          type="button"
          data-work-target-chip
          disabled={isLocked || isLoading}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label="انتخاب پروژه یا هدف کاری"
          title={
            isLocked
              ? `${selectedTarget?.label || 'هدف کاری'} (در زمان اجرای تایمر قفل است)`
              : selectedTarget?.label || 'انتخاب پروژه / هدف کاری'
          }
          onClick={() => !isLocked && !isLoading && setIsOpen((prev) => !prev)}
          className={cn(
            'min-h-[44px] max-w-full sm:max-w-[420px] inline-flex items-center justify-between gap-2.5 px-4 py-2 rounded-full border-[1.5px] transition-all select-none',
            isLocked
              ? 'border-sec/30 dark:border-primary/35 bg-sec/[0.04] dark:bg-[#182030] cursor-not-allowed'
              : isOpen
                ? 'border-primary bg-white dark:bg-[#182030] shadow-ecosystem cursor-pointer'
                : 'border-sec dark:border-primary/45 bg-white dark:bg-[#182030] shadow-male dark:shadow-ecosystem hover:-translate-y-0.5 cursor-pointer'
          )}
        >
          <div className="min-w-0 flex-1">{renderSelectedDisplay(true)}</div>
          {isLocked ? (
            <span
              className="w-6 h-6 rounded-full bg-sec/10 dark:bg-white/10 text-sec dark:text-primary flex items-center justify-center shrink-0"
              aria-label="قفل شده هنگام اجرای تایمر"
            >
              <Lock className="w-3.5 h-3.5" />
            </span>
          ) : (
            <ChevronDown
              className={cn(
                'w-4 h-4 text-sec/60 dark:text-gray-400 shrink-0 transition-transform duration-200',
                isOpen && 'rotate-180 text-sec dark:text-primary'
              )}
            />
          )}
        </button>

        {dropdownMenu}
      </div>
    );
  }

  return (
    <div className="space-y-1.5 relative w-full" ref={containerRef}>
      <div className="flex items-center justify-between text-xs font-bold text-sec/80 dark:text-gray-300">
        <span>پروژه / هدف کاری</span>
        {isLocked && (
          <span className="flex items-center gap-1 text-[#C60036] dark:text-rose-300">
            <Lock className="w-3.5 h-3.5" />
            <span>قفل</span>
          </span>
        )}
      </div>

      <button
        type="button"
        disabled={isLocked || isLoading}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full min-h-[44px] flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border-[1.5px] transition-all text-start',
          isLocked
            ? 'border-sec/20 dark:border-gray-800 bg-gray-100/70 dark:bg-gray-900/40 opacity-75 cursor-not-allowed'
            : isOpen
              ? 'border-primary bg-white dark:bg-[#182030] shadow-male'
              : 'border-sec/25 dark:border-gray-700 bg-white dark:bg-[#182030] hover:border-sec/55 shadow-hard-sm cursor-pointer'
        )}
      >
        <div className="min-w-0 flex-1">{renderSelectedDisplay(false)}</div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-sec/55 dark:text-gray-400 shrink-0 transition-transform',
            isOpen && 'rotate-180 text-primary'
          )}
        />
      </button>

      {dropdownMenu}
    </div>
  );
};
