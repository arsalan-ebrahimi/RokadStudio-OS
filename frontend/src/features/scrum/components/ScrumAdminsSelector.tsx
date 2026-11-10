import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, X, Check, Shield, Users, AlertCircle } from 'lucide-react';
import { Skeleton, ErrorState, Badge } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import { toPersianDigits } from '@/shared/lib/formatters';
import { useScrumAdminsList } from '../hooks/use-scrum';
import type { ScrumAdminRef } from '../types/scrum-types';
import type { Role } from '@/shared/types/models';

export interface ScrumAdminSelection {
  userId: number;
  alsoMember: boolean | null;
}

interface ScrumAdminsSelectorProps {
  selections: ScrumAdminSelection[];
  onChange: (next: ScrumAdminSelection[]) => void;
  excludeIds?: number[];
  knownUsers?: ScrumAdminRef[];
  enabled?: boolean;
  label?: string;
  helperText?: string;
}

function renderAdminRoleBadge(role?: Role) {
  if (role === 'ADMIN') {
    return (
      <Badge variant="college" className="text-[10px] py-0.5 px-2">
        ادمین استودیو
      </Badge>
    );
  }
  if (role === 'SCRUM_ADMIN') {
    return (
      <Badge variant="club" className="text-[10px] py-0.5 px-2">
        مدیر اسکرام
      </Badge>
    );
  }
  return null;
}

export const ScrumAdminsSelector: React.FC<ScrumAdminsSelectorProps> = ({
  selections,
  onChange,
  excludeIds = [],
  knownUsers = [],
  enabled = true,
  label = 'ادمین‌های اسکرام (اختیاری)',
  helperText = 'مدیران اسکرام و ادمین‌های استودیو می‌توانند به عنوان ادمین این اسکرام انتخاب شوند.',
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: allAdmins = [],
    isLoading: isAllLoading,
    isError: isAllError,
    error: allError,
    refetch: refetchAll,
  } = useScrumAdminsList(undefined, enabled);

  const trimmedSearch = searchQuery.trim();
  const {
    data: searchedAdmins,
    isLoading: isSearchLoading,
    isError: isSearchError,
    refetch: refetchSearch,
  } = useScrumAdminsList(trimmedSearch || undefined, enabled && Boolean(trimmedSearch));

  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);

  const userMap = useMemo(() => {
    const map = new Map<number, ScrumAdminRef>();
    for (const u of knownUsers) {
      map.set(u.id, u);
    }
    for (const u of allAdmins) {
      map.set(u.id, u);
    }
    for (const u of searchedAdmins || []) {
      map.set(u.id, u);
    }
    return map;
  }, [knownUsers, allAdmins, searchedAdmins]);

  const availableAllAdmins = useMemo(
    () => allAdmins.filter((a) => !excludeSet.has(a.id)),
    [allAdmins, excludeSet]
  );

  const listToDisplay = useMemo(() => {
    const source = trimmedSearch
      ? searchedAdmins ||
        allAdmins.filter((a) => a.name.toLowerCase().includes(trimmedSearch.toLowerCase()))
      : allAdmins;
    return source.filter((a) => !excludeSet.has(a.id));
  }, [trimmedSearch, allAdmins, searchedAdmins, excludeSet]);

  const selectedIdSet = useMemo(
    () => new Set(selections.map((s) => s.userId)),
    [selections]
  );

  const toggleUser = (id: number) => {
    if (selectedIdSet.has(id)) {
      onChange(selections.filter((item) => item.userId !== id));
    } else {
      // Explicitly start with `null` so creator makes a deliberate choice
      onChange([...selections, { userId: id, alsoMember: null }]);
    }
  };

  const setAlsoMember = (userId: number, alsoMember: boolean) => {
    onChange(
      selections.map((s) => (s.userId === userId ? { ...s, alsoMember } : s))
    );
  };

  if (isAllError) {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-xs font-bold text-ink-normal/80 dark:text-gray-300">
            {label}
          </label>
        )}
        <ErrorState
          title="خطا در دریافت لیست مدیران مجاز"
          message={allError instanceof Error ? allError.message : 'لطفاً دوباره تلاش کنید.'}
          onRetry={() => refetchAll()}
          className="p-4"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <label className="block text-xs font-bold text-ink-normal/80 dark:text-gray-300">
            {label}
          </label>
          {selections.length > 0 && (
            <span className="text-[11px] font-bold text-primary tabular-nums">
              {toPersianDigits(selections.length)} انتخاب‌شده
            </span>
          )}
        </div>
        {helperText && (
          <p className="text-[11px] text-ink-normal/60 dark:text-gray-400 leading-relaxed">
            {helperText}
          </p>
        )}
      </div>

      {/* Candidate Picker */}
      {!isAllLoading && allAdmins.length === 0 ? (
        <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30 space-y-2">
          <div className="flex items-start gap-2">
            <Users className="w-4 h-4 text-college-dark dark:text-amber-300 shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-ink-normal/80 dark:text-gray-200 leading-relaxed">
              هنوز هیچ کاربری با نقش «مدیر اسکرام» یا «ادمین» تعریف نشده است. می‌توانید بعداً ادمین‌ها را اختصاص دهید یا همین حالا نقش کاربر را تغییر دهید.
            </p>
          </div>
          <Link
            to="/panel/users"
            className="inline-flex items-center gap-1 text-xs font-black text-primary hover:underline"
          >
            <span>مدیریت پرسنل و تعیین نقش</span>
          </Link>
        </div>
      ) : !isAllLoading && availableAllAdmins.length === 0 ? (
        <div className="p-3 rounded-xl border border-sec/15 dark:border-gray-700 bg-gray-50 dark:bg-[#182030] text-center">
          <p className="text-xs font-bold text-ink-normal/65 dark:text-gray-400">
            همه ادمین‌های مجاز قبلاً به این اسکرام اضافه شده‌اند.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border-[1.5px] border-sec/20 dark:border-gray-700 bg-white dark:bg-[#151C28] overflow-hidden">
          <div className="h-11 px-3 border-b border-sec/10 dark:border-gray-800 flex items-center gap-2">
            <Search className="w-4 h-4 text-ink-normal/45 dark:text-gray-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی نام مدیر اسکرام یا ادمین..."
              className="w-full h-full bg-transparent text-xs font-bold text-sec dark:text-white placeholder:text-ink-normal/45 dark:placeholder:text-gray-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-normal/50 hover:text-sec dark:hover:text-white cursor-pointer"
                aria-label="پاک کردن جستجو"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-40 overflow-y-auto p-1.5 space-y-1">
            {isAllLoading || (Boolean(trimmedSearch) && isSearchLoading) ? (
              <div className="space-y-1.5 p-1">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : isSearchError ? (
              <div className="p-2 text-center space-y-1">
                <p className="text-[11px] font-bold text-[#C60036]">خطا در جستجو</p>
                <button
                  type="button"
                  onClick={() => refetchSearch()}
                  className="text-[11px] font-black text-sec dark:text-primary hover:underline cursor-pointer"
                >
                  تلاش مجدد
                </button>
              </div>
            ) : listToDisplay.length === 0 ? (
              <p className="p-3 text-center text-xs text-ink-normal/50 dark:text-gray-400 font-bold">
                کاربری با این نام یافت نشد.
              </p>
            ) : (
              listToDisplay.map((admin) => {
                const isSelected = selectedIdSet.has(admin.id);
                return (
                  <button
                    key={admin.id}
                    type="button"
                    onClick={() => toggleUser(admin.id)}
                    className={cn(
                      'w-full min-h-[42px] px-3 py-2 rounded-xl text-start text-xs font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer border',
                      isSelected
                        ? 'bg-ecosystem-light/70 dark:bg-ecosystem-darker/50 text-sec dark:text-ecosystem-light border-sec/30'
                        : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-sec dark:text-gray-200'
                    )}
                  >
                    <span className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="w-6 h-6 rounded-full bg-club-normal text-white text-[10px] font-black flex items-center justify-center shrink-0">
                        {admin.name.slice(0, 1)}
                      </span>
                      <span className="truncate">{admin.name}</span>
                      {renderAdminRoleBadge(admin.role)}
                    </span>
                    <span
                      className={cn(
                        'w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors',
                        isSelected
                          ? 'bg-primary border-sec/40 text-sec'
                          : 'border-gray-300 dark:border-gray-600'
                      )}
                      aria-hidden="true"
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[2.75]" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Explicit "also a member?" decision card per selected admin */}
      {selections.length > 0 && (
        <div className="space-y-2.5 pt-1">
          {selections.map((sel) => {
            const info = userMap.get(sel.userId) || {
              id: sel.userId,
              name: `کاربر ${toPersianDigits(sel.userId)}`,
            };
            const missingChoice = sel.alsoMember === null;

            return (
              <div
                key={sel.userId}
                className={cn(
                  'p-3 rounded-2xl border-[1.5px] space-y-2.5 transition-colors',
                  missingChoice
                    ? 'border-college-normal bg-college-light/40 dark:bg-amber-950/25'
                    : 'border-sec/20 dark:border-gray-700 bg-gray-50/80 dark:bg-[#182030]'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Shield className="w-3.5 h-3.5 text-club-normal dark:text-purple-300 shrink-0" />
                    <span className="text-xs font-black text-sec dark:text-white truncate">
                      {info.name}
                    </span>
                    {renderAdminRoleBadge(info.role)}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleUser(sel.userId)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-normal/50 hover:text-[#C60036] hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                    aria-label={`حذف ${info.name}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black text-sec dark:text-gray-200">
                      آیا ایشان عضو این اسکرام هم هست؟
                    </span>
                    {missingChoice && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#704A0D] dark:text-amber-300">
                        <AlertCircle className="w-3 h-3" />
                        انتخاب الزامی
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAlsoMember(sel.userId, true)}
                      aria-pressed={sel.alsoMember === true}
                      className={cn(
                        'p-2.5 rounded-xl border-[1.5px] text-start transition-all cursor-pointer space-y-0.5',
                        sel.alsoMember === true
                          ? 'bg-primary/20 dark:bg-primary/25 border-sec dark:border-primary shadow-hard-sm'
                          : 'bg-white dark:bg-[#121824] border-sec/15 dark:border-gray-700 hover:border-sec/40'
                      )}
                    >
                      <span className="flex items-center justify-between gap-1 text-xs font-black text-sec dark:text-white">
                        <span>بله، عضو هم هست</span>
                        {sel.alsoMember === true && <Check className="w-3.5 h-3.5 text-sec dark:text-primary shrink-0" />}
                      </span>
                      <span className="block text-[10px] font-medium text-ink-normal/65 dark:text-gray-400 leading-relaxed">
                        تسک می‌گیرد، تایمر می‌زند و در لیدربورد ثبت می‌شود
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAlsoMember(sel.userId, false)}
                      aria-pressed={sel.alsoMember === false}
                      className={cn(
                        'p-2.5 rounded-xl border-[1.5px] text-start transition-all cursor-pointer space-y-0.5',
                        sel.alsoMember === false
                          ? 'bg-primary/20 dark:bg-primary/25 border-sec dark:border-primary shadow-hard-sm'
                          : 'bg-white dark:bg-[#121824] border-sec/15 dark:border-gray-700 hover:border-sec/40'
                      )}
                    >
                      <span className="flex items-center justify-between gap-1 text-xs font-black text-sec dark:text-white">
                        <span>نه، فقط مدیریت</span>
                        {sel.alsoMember === false && <Check className="w-3.5 h-3.5 text-sec dark:text-primary shrink-0" />}
                      </span>
                      <span className="block text-[10px] font-medium text-ink-normal/65 dark:text-gray-400 leading-relaxed">
                        تسک و لیدربورد ندارد
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
