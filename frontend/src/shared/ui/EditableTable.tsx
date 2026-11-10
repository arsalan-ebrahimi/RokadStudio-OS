import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Edit2, Plus, Trash2, Check, X, MoreVertical } from 'lucide-react';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { cn } from '@/shared/lib/utils';
import { toPersianDigits } from '@/shared/lib/formatters';

export const INLINE_INPUT_CLASS =
  'w-full min-h-[44px] px-2.5 py-2 rounded-xl border border-transparent bg-transparent text-xs font-medium text-sec dark:text-white placeholder:text-ink-normal/40 dark:placeholder:text-gray-500 transition-all hover:bg-sec/[0.03] dark:hover:bg-white/[0.04] hover:border-sec/20 dark:hover:border-white/15 focus:bg-white dark:focus:bg-[#151C28] focus:border-primary focus:shadow-hard-sm focus:outline-none';

export interface EditableTableColumn<T> {
  id: string;
  header: string;
  unit?: string;
  width?: string;
  minWidth?: string;
  align?: 'start' | 'center' | 'end';
  mobileFullWidth?: boolean;
  isSticky?: boolean;
  renderView: (row: T, index: number) => React.ReactNode;
  renderEdit?: (
    row: T,
    index: number,
    onChange: (updated: Partial<T>) => void,
    isLastCell: boolean,
    onTabLastCell?: () => void
  ) => React.ReactNode;
}

interface RowWithKey<T> {
  _clientKey: string;
  data: T;
  isNewlyAdded?: boolean;
}

export interface EditableTableProps<T extends { id?: number }> {
  columns: EditableTableColumn<T>[];
  data: T[];
  canEdit: boolean;
  onSave: (draft: T[]) => Promise<void>;
  createEmptyRow: () => T;
  isRowEmpty: (row: T) => boolean;
  title?: string;
  subtitle?: string;
  emptyMessage?: string;
  extraHeaderActions?: React.ReactNode;
  maxHeightClassName?: string;
  className?: string;
}

export function EditableTable<T extends { id?: number }>({
  columns,
  data,
  canEdit,
  onSave,
  createEmptyRow,
  isRowEmpty,
  title,
  subtitle,
  emptyMessage = 'هیچ موردی ثبت نشده است',
  extraHeaderActions,
  maxHeightClassName = 'max-h-[68vh]',
  className,
}: EditableTableProps<T>) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<RowWithKey<T>[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [openMobileMenuKey, setOpenMobileMenuKey] = useState<string | null>(null);
  const [hasHScrollShadow, setHasHScrollShadow] = useState(false);

  const nextKeyRef = useRef(1);
  const newlyAddedKeyRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const generateKey = useCallback(() => {
    return `draft_key_${nextKeyRef.current++}_${Date.now()}`;
  }, []);

  const updateScrollShadow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setHasHScrollShadow(Math.abs(el.scrollLeft) > 4);
  }, []);

  useEffect(() => {
    updateScrollShadow();
    window.addEventListener('resize', updateScrollShadow);
    return () => window.removeEventListener('resize', updateScrollShadow);
  }, [updateScrollShadow, data.length, draft.length, isEditing]);

  // Keep draft synced when not editing
  useEffect(() => {
    if (!isEditing) {
      setDraft(
        data.map((item) => ({
          _clientKey: item.id ? `id_${item.id}` : generateKey(),
          data: { ...item },
        }))
      );
    }
  }, [data, isEditing, generateKey]);

  // Auto-focus the first editable control in a newly added row (desktop or mobile visible element)
  useEffect(() => {
    const newKey = newlyAddedKeyRef.current;
    if (!newKey) return;
    newlyAddedKeyRef.current = null;

    const timer = window.setTimeout(() => {
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-editable-row-key="${newKey}"]`)
      );
      const visibleRow = candidates.find((el) => el.offsetParent !== null) || candidates[0];
      if (!visibleRow) return;
      const focusable = visibleRow.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), select:not(:disabled), button[data-focus-target]:not(:disabled)'
      );
      if (focusable) {
        focusable.focus({ preventScroll: false });
      }
    }, 30);

    return () => window.clearTimeout(timer);
  }, [draft]);

  // Dismiss mobile row overflow menu on Escape / outside click
  useEffect(() => {
    if (!openMobileMenuKey) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMobileMenuKey(null);
    };
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-editable-mobile-menu]')) {
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

  const handleStartEdit = () => {
    if (data.length === 0) {
      const key = generateKey();
      newlyAddedKeyRef.current = key;
      setDraft([{ _clientKey: key, data: createEmptyRow(), isNewlyAdded: true }]);
    } else {
      setDraft(
        data.map((item) => ({
          _clientKey: item.id ? `id_${item.id}` : generateKey(),
          data: { ...item },
        }))
      );
    }
    setIsEditing(true);
  };

  const handleCancel = () => {
    setDraft(
      data.map((item) => ({
        _clientKey: item.id ? `id_${item.id}` : generateKey(),
        data: { ...item },
      }))
    );
    setOpenMobileMenuKey(null);
    setIsEditing(false);
  };

  const handleRowChange = (index: number, updatedFields: Partial<T>) => {
    setDraft((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        data: {
          ...next[index].data,
          ...updatedFields,
        },
      };
      return next;
    });
  };

  const handleAddRow = () => {
    const newKey = generateKey();
    newlyAddedKeyRef.current = newKey;
    setDraft((prev) => [...prev, { _clientKey: newKey, data: createEmptyRow(), isNewlyAdded: true }]);
  };

  const handleDeleteRow = (index: number) => {
    setOpenMobileMenuKey(null);
    setDraft((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        const key = generateKey();
        newlyAddedKeyRef.current = key;
        return [{ _clientKey: key, data: createEmptyRow(), isNewlyAdded: true }];
      }
      return next;
    });
  };

  const changeCount = useMemo(() => {
    if (!isEditing) return 0;
    const cleanDraft = draft.map((d) => d.data).filter((row) => !isRowEmpty(row));
    const cleanOriginal = data.filter((row) => !isRowEmpty(row));

    if (cleanDraft.length !== cleanOriginal.length) {
      return Math.abs(cleanDraft.length - cleanOriginal.length) + 1;
    }

    let diff = 0;
    for (let i = 0; i < cleanDraft.length; i++) {
      const d = cleanDraft[i];
      const o = cleanOriginal[i];
      if (!o || JSON.stringify(d) !== JSON.stringify(o)) {
        diff++;
      }
    }
    return diff;
  }, [isEditing, draft, data, isRowEmpty]);

  const handleSave = async () => {
    const payload = draft.map((d) => d.data).filter((row) => !isRowEmpty(row));
    setIsSaving(true);
    try {
      await onSave(payload);
      setIsEditing(false);
    } catch {
      // Keep draft intact on error
    } finally {
      setIsSaving(false);
    }
  };

  const rowsToDisplay: RowWithKey<T>[] = isEditing
    ? draft
    : data.map((d, idx) => ({ _clientKey: `view_${d.id ?? idx}`, data: d }));

  const titleColIndex = Math.max(
    0,
    columns.findIndex((c) => c.isSticky)
  );
  const titleColumn = columns[titleColIndex] || columns[0];
  const detailColumns = columns.filter((_, idx) => idx !== titleColIndex);

  const floatingPill =
    isEditing &&
    (typeof document !== 'undefined'
      ? createPortal(
          <div
            role="region"
            aria-label="نوار ذخیره تغییرات جدول"
            className="fixed bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-1.5rem)] w-auto rounded-full border-[1.5px] border-sec dark:border-primary bg-white/95 dark:bg-[#151C28]/95 backdrop-blur-md shadow-male dark:shadow-ecosystem px-3 sm:px-5 py-2 flex items-center gap-2.5 sm:gap-4 rokad-pill-rise"
          >
            <div className="flex items-center gap-2 min-w-0 ps-1">
              <span className="w-2.5 h-2.5 rounded-full bg-college-normal animate-pulse shrink-0" />
              <span className="text-xs font-black text-sec dark:text-white whitespace-nowrap hidden sm:inline">
                در حال ویرایش
              </span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-primary/20 text-sec dark:text-primary font-black whitespace-nowrap tabular-nums">
                {changeCount > 0 ? `${toPersianDigits(changeCount)} تغییر` : 'بدون تغییر'}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
                className="rounded-full min-h-[38px] px-3.5 text-xs font-bold gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>انصراف</span>
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSave}
                isLoading={isSaving}
                disabled={changeCount === 0 || isSaving}
                className="rounded-full min-h-[38px] px-4 text-xs font-black gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>
                  ذخیره {changeCount > 0 ? `(${toPersianDigits(changeCount)} تغییر)` : ''}
                </span>
              </Button>
            </div>
          </div>,
          document.body
        )
      : null);

  return (
    <div className={cn('space-y-4', isEditing && 'pb-20', className)}>
      {/* Table Title & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-sec/10 dark:border-gray-800">
        <div>
          {title && <h3 className="text-base sm:text-lg font-black text-sec dark:text-white">{title}</h3>}
          {subtitle && <p className="text-xs text-ink-normal/65 dark:text-gray-400 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {extraHeaderActions && isEditing && extraHeaderActions}
          {canEdit && !isEditing && rowsToDisplay.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartEdit}
              className="text-xs font-bold gap-1.5"
            >
              <Edit2 className="w-3.5 h-3.5 text-primary" />
              <span>ویرایش جدول</span>
            </Button>
          )}
        </div>
      </div>

      {/* Empty View State (when not editing & zero persisted rows) */}
      {!isEditing && rowsToDisplay.length === 0 ? (
        <div className="rounded-3xl border-[1.5px] border-sec dark:border-primary/40 bg-white dark:bg-[#121824] shadow-male dark:shadow-ecosystem overflow-hidden">
          <EmptyState
            title={emptyMessage}
            description={
              canEdit
                ? 'برای افزودن اولین ردیف می‌توانید ویرایش جدول را آغاز کنید.'
                : undefined
            }
            action={
              canEdit ? (
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleStartEdit}
                    className="gap-1.5 text-xs font-black"
                  >
                    <Plus className="w-4 h-4" />
                    <span>افزودن اولین ردیف</span>
                  </Button>
                  {extraHeaderActions}
                </div>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          {/* Edit Mode Banner Container Wrapper */}
          {/* Desktop & Tablet Table View (md+) */}
          <div
            className={cn(
              'hidden md:block rounded-3xl border-[1.5px] bg-white dark:bg-[#121824] overflow-hidden transition-all',
              isEditing
                ? 'border-primary ring-2 ring-primary/35 shadow-ecosystem'
                : 'border-sec dark:border-primary/40 shadow-male dark:shadow-ecosystem'
            )}
          >
            {isEditing && (
              <div className="px-4 py-2 bg-[#ECF7F5] dark:bg-[#182730] border-b border-primary/30 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 font-black text-sec dark:text-primary">
                  <span className="w-2 h-2 rounded-full bg-college-normal animate-pulse shrink-0" />
                  <span>در حال ویرایش</span>
                </div>
                <span className="text-[11px] font-semibold text-sec/70 dark:text-gray-300">
                  روی هر سلول کلیک کنید تا مستقیماً ویرایش شود · Tab در آخرین سلول = ردیف جدید
                </span>
              </div>
            )}

            <div
              ref={scrollRef}
              onScroll={updateScrollShadow}
              className={cn('rokad-table-scroll overflow-auto', maxHeightClassName)}
            >
              <table className="w-full text-start text-xs border-collapse">
                <thead className="sticky top-0 z-20">
                  <tr className="h-12 bg-[#ECF7F5] dark:bg-[#182730] border-b border-sec/15 dark:border-white/10 text-sec/75 dark:text-gray-200 font-semibold">
                    <th className="py-3 px-3.5 w-12 text-center select-none">#</th>
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
                        {col.header}
                      </th>
                    ))}
                    {isEditing && <th className="py-3 px-3 w-14 text-center">عملیات</th>}
                  </tr>
                </thead>
                <tbody>
                  {rowsToDisplay.map((rowItem, rowIndex) => {
                    const isLastRow = rowIndex === rowsToDisplay.length - 1;
                    return (
                      <tr
                        key={rowItem._clientKey}
                        data-editable-row-key={rowItem._clientKey}
                        className={cn(
                          'group border-b border-sec/10 dark:border-white/10 last:border-b-0 transition-colors hover:bg-[#F7F9FB] dark:hover:bg-[#192131]',
                          rowItem.isNewlyAdded && 'rokad-row-enter'
                        )}
                      >
                        <td className="py-3 px-3.5 text-center text-sec/45 dark:text-gray-400 font-bold text-[11px] tabular-nums align-middle">
                          {toPersianDigits(rowIndex + 1)}
                        </td>

                        {columns.map((col, colIndex) => {
                          const isLastCell = isLastRow && colIndex === columns.length - 1;
                          return (
                            <td
                              key={col.id}
                              style={{ minWidth: col.minWidth }}
                              className={cn(
                                'align-middle',
                                isEditing ? 'py-2 px-2.5' : 'py-3.5 px-4',
                                col.align === 'center' && 'text-center tabular-nums',
                                col.align === 'end' && 'text-end',
                                (!col.align || col.align === 'start') && 'text-start',
                                col.isSticky &&
                                  cn(
                                    'sticky start-0 z-10 bg-white dark:bg-[#121824] group-hover:bg-[#F7F9FB] dark:group-hover:bg-[#192131] font-bold transition-colors',
                                    hasHScrollShadow &&
                                      'shadow-[-8px_0_16px_-8px_rgba(32,42,90,0.16)] dark:shadow-[-8px_0_16px_-8px_rgba(0,0,0,0.45)]'
                                  )
                              )}
                            >
                              {isEditing && col.renderEdit
                                ? col.renderEdit(
                                    rowItem.data,
                                    rowIndex,
                                    (updated) => handleRowChange(rowIndex, updated),
                                    isLastCell,
                                    isLastCell ? handleAddRow : undefined
                                  )
                                : col.renderView(rowItem.data, rowIndex)}
                            </td>
                          );
                        })}

                        {isEditing && (
                          <td className="py-2 px-2 text-center align-middle">
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(rowIndex)}
                              className="w-10 h-10 inline-flex items-center justify-center rounded-xl text-sec/55 dark:text-gray-400 hover:text-[#C60036] dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100 focus-visible:opacity-100"
                              title="حذف ردیف"
                              aria-label="حذف ردیف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Dashed Full-Width Ghost Row (+ ردیف جدید) */}
            {isEditing && (
              <div className="p-2.5 bg-white dark:bg-[#121824] border-t border-sec/10 dark:border-white/10">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl border-[1.5px] border-dashed border-sec/25 dark:border-white/20 hover:border-primary hover:bg-primary/[0.08] text-xs font-extrabold text-sec/75 dark:text-gray-200 hover:text-sec dark:hover:text-primary flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-primary" />
                  <span>ردیف جدید</span>
                </button>
              </div>
            )}
          </div>

          {/* Mobile Stacked Card View (<768px) for BOTH View and Edit Modes */}
          <div className="md:hidden space-y-3">
            {isEditing && (
              <div className="px-3.5 py-2.5 rounded-2xl bg-[#ECF7F5] dark:bg-[#182730] border-[1.5px] border-primary flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 font-black text-sec dark:text-primary">
                  <span className="w-2 h-2 rounded-full bg-college-normal animate-pulse shrink-0" />
                  <span>در حال ویرایش</span>
                </div>
                <span className="text-[11px] font-bold text-sec/65 dark:text-gray-300 tabular-nums">
                  {toPersianDigits(rowsToDisplay.length)} ردیف
                </span>
              </div>
            )}

            {rowsToDisplay.map((rowItem, rowIndex) => {
              const isLastRow = rowIndex === rowsToDisplay.length - 1;
              const isMenuOpen = openMobileMenuKey === rowItem._clientKey;

              return (
                <div
                  key={rowItem._clientKey}
                  data-editable-row-key={rowItem._clientKey}
                  className={cn(
                    'rounded-2xl border-[1.5px] bg-white dark:bg-[#121824] p-4 space-y-3.5 relative',
                    isEditing
                      ? 'border-primary ring-1 ring-primary/25 shadow-ecosystem'
                      : 'border-sec dark:border-primary/40 shadow-male dark:shadow-ecosystem',
                    rowItem.isNewlyAdded && 'rokad-row-enter'
                  )}
                >
                  {/* Card Title + Overflow Menu */}
                  <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-sec/10 dark:border-white/10">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span className="mt-1 px-2 py-0.5 rounded-lg bg-primary/[0.14] text-sec dark:text-primary text-[11px] font-black tabular-nums shrink-0">
                        {toPersianDigits(rowIndex + 1)}
                      </span>
                      <div className="min-w-0 flex-1 text-sm font-black text-sec dark:text-white">
                        {isEditing && titleColumn?.renderEdit
                          ? titleColumn.renderEdit(
                              rowItem.data,
                              rowIndex,
                              (updated) => handleRowChange(rowIndex, updated),
                              false,
                              undefined
                            )
                          : titleColumn?.renderView(rowItem.data, rowIndex)}
                      </div>
                    </div>

                    {isEditing && (
                      <div className="relative shrink-0" data-editable-mobile-menu>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMobileMenuKey(isMenuOpen ? null : rowItem._clientKey)
                          }
                          className="w-11 h-11 -m-2 flex items-center justify-center rounded-xl text-sec/70 dark:text-gray-300 hover:bg-sec/[0.06] dark:hover:bg-white/10 cursor-pointer"
                          aria-label="عملیات ردیف"
                          aria-expanded={isMenuOpen}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {isMenuOpen && (
                          <div
                            role="menu"
                            className="absolute end-0 top-full mt-1 z-30 w-40 rounded-2xl border-[1.5px] border-sec dark:border-primary/45 bg-white dark:bg-[#151C28] shadow-male p-1.5 animate-in fade-in zoom-in-95 duration-100"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => handleDeleteRow(rowIndex)}
                              className="w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold text-start text-[#C60036] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 shrink-0" />
                              <span>حذف ردیف</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 2-Column Label / Value Grid */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
                    {detailColumns.map((col) => {
                      const colIdx = columns.indexOf(col);
                      const isLastCell = isLastRow && colIdx === columns.length - 1;
                      const spanFull = Boolean(col.mobileFullWidth || (isEditing && col.renderEdit && col.minWidth && parseInt(col.minWidth, 10) >= 200));

                      return (
                        <div
                          key={col.id}
                          className={cn('space-y-1 min-w-0', spanFull && 'col-span-2')}
                        >
                          <div className="text-[11px] font-semibold text-sec/60 dark:text-gray-400">
                            {col.header}
                          </div>
                          <div className="font-bold text-sec dark:text-white break-words">
                            {isEditing && col.renderEdit
                              ? col.renderEdit(
                                  rowItem.data,
                                  rowIndex,
                                  (updated) => handleRowChange(rowIndex, updated),
                                  isLastCell,
                                  isLastCell ? handleAddRow : undefined
                                )
                              : col.renderView(rowItem.data, rowIndex)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {isEditing && (
              <button
                type="button"
                onClick={handleAddRow}
                className="w-full min-h-[48px] px-4 py-3 rounded-2xl border-[1.5px] border-dashed border-sec/30 dark:border-primary/40 bg-white dark:bg-[#121824] hover:border-primary hover:bg-primary/[0.08] text-xs font-extrabold text-sec/80 dark:text-gray-200 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 text-primary" />
                <span>ردیف جدید</span>
              </button>
            )}
          </div>
        </>
      )}

      {floatingPill}
    </div>
  );
}
