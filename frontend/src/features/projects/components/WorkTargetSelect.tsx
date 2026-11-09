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
import { useAuthStore } from '@/features/auth';
import { useWorkTargetsMine } from '@/features/scrum/hooks/use-scrum';
import { SCRUM_COLOR_MAP, type ScrumColor } from '@/features/scrum/types/scrum-types';
import type { TimerTarget } from '@/features/timer/lib/timer-engine';
import { toPersianDigits } from '@/shared/lib/formatters';

interface WorkTargetSelectProps {
  selectedTarget: TimerTarget | null;
  onSelect: (target: TimerTarget) => void;
  isLocked?: boolean;
}

export const WorkTargetSelect: React.FC<WorkTargetSelectProps> = ({
  selectedTarget,
  onSelect,
  isLocked = false,
}) => {
  const { user } = useAuthStore();
  const userId = user?.id || 'guest';
  const { data: targetsData, isLoading } = useWorkTargetsMine();

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Read recent targets from localStorage, augmented by API recent
  const recentTargets = useMemo<TimerTarget[]>(() => {
    const map = new Map<string, TimerTarget>();

    // 1. LocalStorage
    try {
      const raw = localStorage.getItem(`rokad_recent_targets_${userId}`);
      if (raw) {
        const parsed: TimerTarget[] = JSON.parse(raw);
        for (const t of parsed) {
          if (t && t.id && t.kind) {
            map.set(`${t.kind}_${t.id}`, t);
          }
        }
      }
    } catch {
      // Ignore
    }

    // 2. API fallback
    if (targetsData?.recent) {
      for (const r of targetsData.recent) {
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
  }, [userId, targetsData?.recent]);

  // Filter items by search term
  const filteredActiveScrums = useMemo(() => {
    if (!targetsData?.scrums) return [];
    if (!searchTerm.trim()) return targetsData.scrums;

    const term = searchTerm.toLowerCase();
    return targetsData.scrums
      .map((s) => ({
        ...s,
        items: s.items.filter(
          (item) =>
            item.name.toLowerCase().includes(term) ||
            s.scrum.name.toLowerCase().includes(term)
        ),
      }))
      .filter((s) => s.items.length > 0);
  }, [targetsData?.scrums, searchTerm]);

  const filteredStudioProjects = useMemo(() => {
    if (!targetsData?.studioProjects) return [];
    if (!searchTerm.trim()) return targetsData.studioProjects;

    const term = searchTerm.toLowerCase();
    return targetsData.studioProjects.filter((p) =>
      p.name.toLowerCase().includes(term)
    );
  }, [targetsData?.studioProjects, searchTerm]);

  const totalActiveSprintItems = useMemo(() => {
    return (targetsData?.scrums || []).reduce((acc, s) => acc + s.items.length, 0);
  }, [targetsData?.scrums]);

  const handleSelect = (target: TimerTarget) => {
    onSelect(target);
    setIsOpen(false);
    setSearchTerm('');
  };

  // Helper to format target path for display
  const renderSelectedDisplay = () => {
    if (!selectedTarget) {
      return (
        <span className="text-ink-normal/50 dark:text-gray-400 text-xs sm:text-sm">
          {isLoading ? 'در حال بارگذاری اهداف...' : 'انتخاب هدف کاری (اسپرینت یا پروژه استودیو)...'}
        </span>
      );
    }

    if (selectedTarget.kind === 'SPRINT') {
      const match = selectedTarget.label.match(/^\[(.*?)\]\s*(.*)$/);
      const prefix = match ? match[1] : null;
      const title = match ? match[2] : selectedTarget.label;
      const colorMeta = selectedTarget.scrumColor
        ? SCRUM_COLOR_MAP[selectedTarget.scrumColor as ScrumColor]
        : null;

      return (
        <div className="flex items-center gap-2 min-w-0">
          {prefix && (
            <span
              className="px-2 py-0.5 rounded-lg border text-[11px] font-black shrink-0 flex items-center gap-1 shadow-sm"
              style={{
                backgroundColor: colorMeta?.bg ? undefined : 'rgba(97, 43, 137, 0.08)',
                color: colorMeta?.accent || '#612B89',
                borderColor: colorMeta?.accent ? `${colorMeta.accent}40` : '#612B8930',
              }}
            >
              {colorMeta?.accent && (
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: colorMeta.accent }}
                />
              )}
              <span>{prefix}</span>
            </span>
          )}
          <span className="text-xs sm:text-sm font-bold text-sec dark:text-white truncate">
            {title}
          </span>
          {typeof selectedTarget.points === 'number' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-ink-normal/60 dark:text-gray-300 font-mono shrink-0">
              {toPersianDigits(selectedTarget.points)} pt
            </span>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 min-w-0">
        <FolderKanban className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs sm:text-sm font-bold text-sec dark:text-white truncate">
          {selectedTarget.label}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-1.5 relative" ref={containerRef}>
      {/* Top Label */}
      <div className="flex items-center justify-between text-xs font-bold text-ink-normal/80 dark:text-gray-300">
        <span>پروژه / هدف کاری</span>
        {isLocked && (
          <span className="flex items-center gap-1 text-[#E0195B]">
            <Lock className="w-3.5 h-3.5" />
            <span>قفل</span>
          </span>
        )}
      </div>

      {/* Main Trigger Button */}
      <button
        type="button"
        disabled={isLocked || isLoading}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border-2 transition-all text-right ${
          isLocked
            ? 'border-gray-200 dark:border-gray-800 bg-gray-100/70 dark:bg-gray-900/40 opacity-70 cursor-not-allowed'
            : isOpen
            ? 'border-primary bg-white dark:bg-[#182030] shadow-hard'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#182030] hover:border-primary/50 shadow-hard-sm cursor-pointer'
        }`}
      >
        <div className="min-w-0 flex-1">{renderSelectedDisplay()}</div>
        <ChevronDown
          className={`w-4 h-4 text-ink-normal/50 dark:text-gray-400 shrink-0 transition-transform ${
            isOpen ? 'rotate-180 text-primary' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && !isLocked && (
        <div className="absolute top-full start-0 end-0 z-50 mt-1.5 bg-white dark:bg-[#182030] rounded-2xl border-2 border-primary/30 shadow-hard-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Header */}
          <div className="p-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
            <Search className="w-4 h-4 text-ink-normal/40 dark:text-gray-400 shrink-0" />
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
                className="text-ink-normal/40 hover:text-ink-normal"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto p-2 space-y-3.5">
            {/* GROUP 1: اخیراً استفاده‌شده */}
            {!searchTerm && recentTargets.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 px-2 text-[11px] font-black text-ink-normal/50 dark:text-gray-400">
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
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-right text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-primary/10 text-primary font-black border border-primary/30'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-sec dark:text-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {rt.kind === 'SPRINT' ? (
                            <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          ) : (
                            <FolderKanban className="w-3.5 h-3.5 text-primary shrink-0" />
                          )}
                          <span className="truncate">{rt.label}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* GROUP 2: اسپرینت‌های فعال من */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 px-2 text-[11px] font-black text-ink-normal/50 dark:text-gray-400">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>اسپرینت‌های فعال من</span>
              </div>

              {totalActiveSprintItems === 0 ? (
                <div className="px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 text-center">
                  <p className="text-[11px] text-ink-normal/50 dark:text-gray-400 font-bold">
                    پروژه‌ای در اسپرینت‌های فعال به شما اختصاص نیافته است.
                  </p>
                </div>
              ) : filteredActiveScrums.length === 0 ? (
                <p className="px-3 py-2 text-[11px] text-ink-normal/40 italic">
                  موردی یافت نشد.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {filteredActiveScrums.map((s) => {
                    const colorMeta = SCRUM_COLOR_MAP[s.scrum.color] || SCRUM_COLOR_MAP.ECOSYSTEM;
                    return (
                      <div
                        key={`scrum_${s.scrum.id}_sprint_${s.sprint.id}`}
                        className="rounded-xl border border-gray-200 dark:border-gray-700 p-2 space-y-1 bg-gray-50/50 dark:bg-gray-800/30"
                      >
                        {/* Scrum & Sprint Header */}
                        <div className="flex items-center gap-2 px-1.5 py-1 text-xs font-black">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: colorMeta.accent }}
                          />
                          <span className="text-sec dark:text-white truncate">
                            {s.scrum.name}
                          </span>
                          <span className="text-[11px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-mono font-bold">
                            S{toPersianDigits(s.sprint.number)}
                          </span>
                        </div>

                        {/* Items */}
                        <div className="space-y-1">
                          {s.items.map((item) => {
                            const isSelected =
                              selectedTarget?.kind === 'SPRINT' && selectedTarget?.id === item.id;
                            const fullLabel = `[${s.scrum.name} · S${s.sprint.number}] ${item.name}`;

                            return (
                              <button
                                key={`item_${item.id}`}
                                type="button"
                                onClick={() =>
                                  handleSelect({
                                    kind: 'SPRINT',
                                    id: item.id,
                                    label: fullLabel,
                                    points: item.points,
                                    scrumColor: s.scrum.color,
                                  })
                                }
                                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-right text-xs transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-primary text-white font-bold shadow-sm'
                                    : 'hover:bg-white dark:hover:bg-gray-700 text-sec dark:text-gray-200'
                                }`}
                              >
                                <span className="truncate min-w-0">{item.name}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span
                                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                                      isSelected
                                        ? 'bg-white/20 text-white'
                                        : 'bg-gray-200 dark:bg-gray-700 text-ink-normal/70 dark:text-gray-300'
                                    }`}
                                  >
                                    {toPersianDigits(item.points)} pt
                                  </span>
                                  {isSelected && <Check className="w-3.5 h-3.5" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* GROUP 3: پروژه‌های استودیو */}
            <div className="space-y-1.5 pt-1 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-1.5 px-2 text-[11px] font-black text-ink-normal/50 dark:text-gray-400">
                <FolderKanban className="w-3.5 h-3.5 text-primary" />
                <span>پروژه‌های استودیو</span>
              </div>

              {filteredStudioProjects.length === 0 ? (
                <p className="px-3 py-2 text-[11px] text-ink-normal/40 italic">
                  پروژه‌ای اختصاص نیافته است.
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredStudioProjects.map((p) => {
                    const isSelected =
                      selectedTarget?.kind === 'STUDIO' && selectedTarget?.id === p.id;
                    return (
                      <button
                        key={`studio_${p.id}`}
                        type="button"
                        onClick={() =>
                          handleSelect({
                            kind: 'STUDIO',
                            id: p.id,
                            label: p.name,
                          })
                        }
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-right text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-primary/10 text-primary font-black border border-primary/30'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-sec dark:text-gray-200'
                        }`}
                      >
                        <span className="truncate">{p.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

