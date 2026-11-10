import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { cn } from '../lib/utils';
import { toPersianDigits } from '../lib/formatters';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';

export type TableStatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export const StatusDotPill: React.FC<{
  tone?: TableStatusTone;
  label: React.ReactNode;
  pulse?: boolean;
  className?: string;
}> = ({ tone = 'neutral', label, pulse = false, className }) => {
  const pillTones: Record<TableStatusTone, string> = {
    success:
      'bg-emerald-50 dark:bg-emerald-950/50 text-[#007A52] dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
    warning:
      'bg-college-light dark:bg-college-darker/55 text-[#704A0D] dark:text-amber-200 border-college-normal/50',
    danger:
      'bg-female-light dark:bg-female-darker/55 text-[#C60036] dark:text-rose-200 border-female-normal/40',
    info:
      'bg-ecosystem-light dark:bg-ecosystem-darker/55 text-sec dark:text-ecosystem-light border-primary/45',
    neutral:
      'bg-gray-100 dark:bg-gray-800 text-sec/80 dark:text-gray-200 border-gray-300 dark:border-gray-700',
  };

  const dotTones: Record<TableStatusTone, string> = {
    success: 'bg-[#009966]',
    warning: 'bg-[#F8A41D]',
    danger: 'bg-[#E0195B]',
    info: 'bg-[#59BBAF]',
    neutral: 'bg-gray-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold whitespace-nowrap leading-none',
        pillTones[tone],
        className
      )}
    >
      <span
        className={cn('w-2 h-2 rounded-full shrink-0', dotTones[tone], pulse && 'animate-pulse')}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
};

export const UnitChip: React.FC<{ unit?: string | null; className?: string }> = ({ unit, className }) => {
  if (!unit || !unit.trim()) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded-md bg-sec/[0.06] dark:bg-white/[0.08] text-sec/65 dark:text-gray-300 text-[10px] font-bold leading-none shrink-0',
        className
      )}
    >
      {unit}
    </span>
  );
};

export interface DataTableColumn<T> {
  id: string;
  header: React.ReactNode;
  unit?: string;
  width?: string;
  minWidth?: string;
  align?: 'start' | 'center' | 'end';
  isSticky?: boolean;
  mobileFullWidth?: boolean;
  cell: (row: T, index: number) => React.ReactNode;
}

export interface DataTableMobileMenuAction<T> {
  label: string;
  icon?: React.ReactNode;
  tone?: 'default' | 'danger';
  onClick: (row: T, index: number) => void;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowKey: (row: T, index: number) => string | number;
  showIndex?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  errorTitle?: string;
  errorMessage?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  renderRowActions?: (row: T, index: number) => React.ReactNode;
  mobileActions?: (row: T, index: number) => DataTableMobileMenuAction<T>[];
  actionsHeader?: string;
  maxHeightClassName?: string;
  footnote?: React.ReactNode;
  onRowClick?: (row: T, index: number) => void;
  className?: string;
  tableClassName?: string;
}

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  showIndex = true,
  isLoading = false,
  isError = false,
  errorTitle = 'خطا در دریافت داده‌ها',
  errorMessage,
  onRetry,
  emptyTitle = 'هیچ موردی یافت نشد',
  emptyDescription,
  emptyAction,
  renderRowActions,
  mobileActions,
  actionsHeader = 'عملیات',
  maxHeightClassName = 'max-h-[68vh]',
  footnote,
  onRowClick,
  className,
  tableClassName,
}: DataTableProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasHScrollShadow, setHasHScrollShadow] = useState(false);
  const [openMobileMenuKey, setOpenMobileMenuKey] = useState<string | number | null>(null);

  const updateScrollShadow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setHasHScrollShadow(Math.abs(el.scrollLeft) > 4);
  }, []);

  useEffect(() => {
    updateScrollShadow();
    window.addEventListener('resize', updateScrollShadow);
    return () => window.removeEventListener('resize', updateScrollShadow);
  }, [updateScrollShadow, data.length, columns.length]);

  useEffect(() => {
    if (openMobileMenuKey === null) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMobileMenuKey(null);
    };
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-mobile-table-menu]')) {
        setOpenMobileMenuKey(null);
      }
    };
    document.addEventListener('keydown', handleEsc);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMobileMenuKey]);

  const titleColIndex = Math.max(
    0,
    columns.findIndex((c) => c.isSticky)
  );
  const titleColumn = columns[titleColIndex] || columns[0];
  const detailColumns = columns.filter((_, idx) => idx !== titleColIndex);

  if (isLoading) {
    return (
      <div
        className={cn(
          'rounded-3xl border-[1.5px] border-sec dark:border-primary/40 bg-white dark:bg-[#121824] shadow-male dark:shadow-ecosystem overflow-hidden',
          className
        )}
      >
        <div className="h-12 bg-[#ECF7F5] dark:bg-[#182730] border-b border-sec/15 dark:border-white/10 px-4 flex items-center gap-4">
          <Skeleton className="h-3.5 w-8" />
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3.5 w-24 hidden sm:block" />
          <Skeleton className="h-3.5 w-24 hidden md:block" />
        </div>
        <div className="divide-y divide-sec/10 dark:divide-white/10">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="min-h-[56px] px-4 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="h-4 w-6" />
                <Skeleton className="h-4 w-40 max-w-full" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full hidden sm:block" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className={cn(
          'rounded-3xl border-[1.5px] border-sec dark:border-primary/40 bg-white dark:bg-[#121824] shadow-male dark:shadow-ecosystem p-4 sm:p-6',
          className
        )}
      >
        <ErrorState
          title={errorTitle}
          message={errorMessage}
          onRetry={onRetry}
          className="border-0 bg-transparent dark:bg-transparent p-2"
        />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className={cn(
          'rounded-3xl border-[1.5px] border-sec dark:border-primary/40 bg-white dark:bg-[#121824] shadow-male dark:shadow-ecosystem overflow-hidden',
          className
        )}
      >
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Desktop & Tablet Table View (md+) */}
      <div className="hidden md:block rounded-3xl border-[1.5px] border-sec dark:border-primary/40 bg-white dark:bg-[#121824] shadow-male dark:shadow-ecosystem overflow-hidden">
        <div
          ref={scrollRef}
          onScroll={updateScrollShadow}
          className={cn('rokad-table-scroll overflow-auto', maxHeightClassName)}
        >
          <table className={cn('w-full text-start text-xs border-collapse', tableClassName)}>
            <thead className="sticky top-0 z-20">
              <tr className="h-12 bg-[#ECF7F5] dark:bg-[#182730] border-b border-sec/15 dark:border-white/10 text-sec/75 dark:text-gray-200 font-semibold">
                {showIndex && (
                  <th className="py-3 px-4 w-12 text-center select-none">#</th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.id}
                    style={{ width: col.width, minWidth: col.minWidth }}
                    className={cn(
                      'py-3 px-4 whitespace-nowrap',
                      col.align === 'center' && 'text-center',
                      col.align === 'end' && 'text-end',
                      (!col.align || col.align === 'start') && 'text-start',
                      col.isSticky &&
                        cn(
                          'sticky start-0 z-30 bg-[#ECF7F5] dark:bg-[#182730] transition-shadow',
                          hasHScrollShadow &&
                            'shadow-[-8px_0_16px_-8px_rgba(32,42,90,0.2)] dark:shadow-[-8px_0_16px_-8px_rgba(0,0,0,0.45)]'
                        )
                    )}
                  >
                    <div
                      className={cn(
                        'inline-flex items-center gap-1.5',
                        col.align === 'center' && 'justify-center',
                        col.align === 'end' && 'justify-end'
                      )}
                    >
                      <span>{col.header}</span>
                      {col.unit && <UnitChip unit={col.unit} />}
                    </div>
                  </th>
                ))}
                {renderRowActions && (
                  <th className="py-3 px-4 text-end whitespace-nowrap">{actionsHeader}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIndex) => {
                const key = getRowKey(row, rowIndex);
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row, rowIndex) : undefined}
                    className={cn(
                      'group border-b border-sec/10 dark:border-white/10 last:border-b-0 transition-colors hover:bg-[#F7F9FB] dark:hover:bg-[#192131]',
                      onRowClick && 'cursor-pointer'
                    )}
                  >
                    {showIndex && (
                      <td className="py-3.5 px-4 text-center text-[11px] font-bold text-sec/45 dark:text-gray-400 tabular-nums align-middle">
                        {toPersianDigits(rowIndex + 1)}
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        style={{ minWidth: col.minWidth }}
                        className={cn(
                          'py-3.5 px-4 min-h-[56px] align-middle',
                          col.align === 'center' && 'text-center tabular-nums',
                          col.align === 'end' && 'text-end',
                          (!col.align || col.align === 'start') && 'text-start',
                          col.isSticky &&
                            cn(
                              'sticky start-0 z-10 bg-white dark:bg-[#121824] group-hover:bg-[#F7F9FB] dark:group-hover:bg-[#192131] transition-colors',
                              hasHScrollShadow &&
                                'shadow-[-8px_0_16px_-8px_rgba(32,42,90,0.16)] dark:shadow-[-8px_0_16px_-8px_rgba(0,0,0,0.45)]'
                            )
                        )}
                      >
                        <div
                          className={cn(
                            'min-h-[32px] flex items-center',
                            col.align === 'center' && 'justify-center',
                            col.align === 'end' && 'justify-end'
                          )}
                        >
                          {col.cell(row, rowIndex)}
                        </div>
                      </td>
                    ))}
                    {renderRowActions && (
                      <td className="py-3 px-4 text-end align-middle">
                        <div className="flex items-center justify-end gap-1.5 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100 transition-opacity">
                          {renderRowActions(row, rowIndex)}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {footnote && (
          <div className="px-4 py-3 bg-[#ECF7F5]/60 dark:bg-[#151C28] border-t border-sec/10 dark:border-white/10 text-[11px] text-sec/65 dark:text-gray-400 font-bold text-center">
            {footnote}
          </div>
        )}
      </div>

      {/* Mobile Stacked Card View (<768px) */}
      <div className="md:hidden space-y-3">
        {data.map((row, rowIndex) => {
          const key = getRowKey(row, rowIndex);
          const menuItems = mobileActions ? mobileActions(row, rowIndex) : [];
          const hasMenu = menuItems.length > 0;
          const isMenuOpen = openMobileMenuKey === key;

          return (
            <div
              key={key}
              onClick={onRowClick ? () => onRowClick(row, rowIndex) : undefined}
              className={cn(
                'rounded-2xl border-[1.5px] border-sec dark:border-primary/40 bg-white dark:bg-[#121824] shadow-male dark:shadow-ecosystem p-4 space-y-3.5 relative',
                onRowClick && 'cursor-pointer'
              )}
            >
              {/* Card Title Row */}
              <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-sec/10 dark:border-white/10">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  {showIndex && (
                    <span className="mt-0.5 px-2 py-0.5 rounded-lg bg-primary/[0.14] text-sec dark:text-primary text-[11px] font-black tabular-nums shrink-0">
                      {toPersianDigits(rowIndex + 1)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1 text-sm font-black text-sec dark:text-white">
                    {titleColumn?.cell(row, rowIndex)}
                  </div>
                </div>

                {hasMenu && (
                  <div className="relative shrink-0" data-mobile-table-menu>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMobileMenuKey(isMenuOpen ? null : key);
                      }}
                      className="w-11 h-11 -m-2 flex items-center justify-center rounded-xl text-sec/70 dark:text-gray-300 hover:bg-sec/[0.06] dark:hover:bg-white/10 cursor-pointer"
                      aria-label="عملیات ردیف"
                      aria-expanded={isMenuOpen}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {isMenuOpen && (
                      <div
                        role="menu"
                        className="absolute end-0 top-full mt-1 z-30 w-44 rounded-2xl border-[1.5px] border-sec dark:border-primary/45 bg-white dark:bg-[#151C28] shadow-male p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100"
                      >
                        {menuItems.map((action, aIdx) => (
                          <button
                            key={aIdx}
                            type="button"
                            role="menuitem"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMobileMenuKey(null);
                              action.onClick(row, rowIndex);
                            }}
                            className={cn(
                              'w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold text-start flex items-center gap-2 cursor-pointer transition-colors',
                              action.tone === 'danger'
                                ? 'text-[#C60036] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                : 'text-sec dark:text-gray-200 hover:bg-sec/[0.06] dark:hover:bg-white/10'
                            )}
                          >
                            {action.icon}
                            <span>{action.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2-Column Label / Value Grid */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
                {detailColumns.map((col) => (
                  <div
                    key={col.id}
                    className={cn('space-y-1 min-w-0', col.mobileFullWidth && 'col-span-2')}
                  >
                    <div className="text-[11px] font-semibold text-sec/60 dark:text-gray-400 flex items-center gap-1">
                      <span className="truncate">{col.header}</span>
                      {col.unit && <UnitChip unit={col.unit} />}
                    </div>
                    <div className="font-bold text-sec dark:text-white break-words">
                      {col.cell(row, rowIndex)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Direct Mobile Row Actions fallback if renderRowActions given without mobileActions */}
              {!hasMenu && renderRowActions && (
                <div className="pt-2.5 border-t border-sec/10 dark:border-white/10 flex items-center justify-end gap-2">
                  {renderRowActions(row, rowIndex)}
                </div>
              )}
            </div>
          );
        })}

        {footnote && (
          <p className="text-[11px] text-sec/60 dark:text-gray-400 font-bold text-center pt-1">
            {footnote}
          </p>
        )}
      </div>
    </div>
  );
}
