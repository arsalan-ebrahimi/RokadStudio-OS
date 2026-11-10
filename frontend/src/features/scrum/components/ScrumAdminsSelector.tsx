import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, X, Check, Shield, Users } from 'lucide-react';
import { Skeleton, ErrorState } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import { toPersianDigits } from '@/shared/lib/formatters';
import { useScrumAdminsList } from '../hooks/use-scrum';
import type { ScrumUserRef } from '../types/scrum-types';

interface ScrumAdminsSelectorProps {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  knownUsers?: ScrumUserRef[];
  enabled?: boolean;
  label?: string;
}

export const ScrumAdminsSelector: React.FC<ScrumAdminsSelectorProps> = ({
  selectedIds,
  onChange,
  knownUsers = [],
  enabled = true,
  label = 'ادمین‌های اسکرام (اختیاری)',
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch full unfiltered list so we can distinguish "no SCRUM_ADMIN users exist" from empty search results
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

  const userMap = useMemo(() => {
    const map = new Map<number, ScrumUserRef>();
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

  const listToDisplay = useMemo(() => {
    if (!trimmedSearch) return allAdmins;
    if (searchedAdmins) return searchedAdmins;
    const lower = trimmedSearch.toLowerCase();
    return allAdmins.filter((a) => a.name.toLowerCase().includes(lower));
  }, [trimmedSearch, allAdmins, searchedAdmins]);

  const selectedUsers = useMemo(
    () =>
      selectedIds.map((id) => userMap.get(id) || { id, name: `کاربر ${toPersianDigits(id)}` }),
    [selectedIds, userMap]
  );

  const toggleUser = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
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
          title="خطا در دریافت لیست مدیران اسکرام"
          message={allError instanceof Error ? allError.message : 'لطفاً دوباره تلاش کنید.'}
          onRetry={() => refetchAll()}
          className="p-4"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-ink-normal/80 dark:text-gray-300">
          {label}
        </label>
        {selectedIds.length > 0 && (
          <span className="text-[11px] font-bold text-primary">
            {toPersianDigits(selectedIds.length)} انتخاب‌شده
          </span>
        )}
      </div>

      {/* Selected Admin Token Chips */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-gray-50 dark:bg-[#182030] border border-gray-200 dark:border-gray-700">
          {selectedUsers.map((admin) => (
            <span
              key={admin.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-club-light dark:bg-club-darker/70 text-club-normal dark:text-purple-200 border border-club-normal/30 text-[11px] font-bold"
            >
              <Shield className="w-3 h-3 shrink-0" />
              <span>{admin.name}</span>
              <button
                type="button"
                onClick={() => toggleUser(admin.id)}
                className="p-0.5 rounded-full hover:bg-club-normal/15 transition-colors cursor-pointer"
                aria-label={`حذف ${admin.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* When no SCRUM_ADMIN users exist in the system */}
      {!isAllLoading && allAdmins.length === 0 ? (
        <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30 space-y-2">
          <div className="flex items-start gap-2">
            <Users className="w-4 h-4 text-college-dark dark:text-amber-300 shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-ink-normal/80 dark:text-gray-200 leading-relaxed">
              هنوز هیچ کاربری با نقش «مدیر اسکرام» تعریف نشده است. می‌توانید بعداً ادمین‌ها را اختصاص دهید یا همین حالا نقش کاربر را تغییر دهید.
            </p>
          </div>
          <Link
            to="/panel/users"
            className="inline-flex items-center gap-1 text-xs font-black text-primary hover:underline"
          >
            <span>مدیریت پرسنل و تعیین مدیر اسکرام</span>
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border-[1.5px] border-sec/20 dark:border-gray-700 bg-white dark:bg-[#151C28] overflow-hidden">
          <div className="h-11 px-3 border-b border-sec/10 dark:border-gray-800 flex items-center gap-2">
            <Search className="w-4 h-4 text-ink-normal/45 dark:text-gray-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی نام مدیر اسکرام..."
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

          <div className="max-h-44 overflow-y-auto p-1.5 space-y-1">
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
                مدیر اسکرامی با این نام یافت نشد.
              </p>
            ) : (
              listToDisplay.map((admin) => {
                const isSelected = selectedIds.includes(admin.id);
                return (
                  <button
                    key={admin.id}
                    type="button"
                    onClick={() => toggleUser(admin.id)}
                    className={cn(
                      'w-full min-h-[42px] px-3 py-2 rounded-xl text-start text-xs font-bold flex items-center justify-between transition-colors cursor-pointer border',
                      isSelected
                        ? 'bg-ecosystem-light/70 dark:bg-ecosystem-darker/50 text-sec dark:text-ecosystem-light border-sec/30'
                        : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-sec dark:text-gray-200'
                    )}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-club-normal text-white text-[10px] font-black flex items-center justify-center shrink-0">
                        {admin.name.slice(0, 1)}
                      </span>
                      <span className="truncate">{admin.name}</span>
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
    </div>
  );
};
