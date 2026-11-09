import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Edit2, Plus, Trash2, Check, X } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import { cn } from '@/shared/lib/utils';
import { toPersianDigits } from '@/shared/lib/formatters';

export interface EditableTableColumn<T> {
  id: string;
  header: string;
  width?: string;
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
  className,
}: EditableTableProps<T>) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<RowWithKey<T>[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const nextKeyRef = useRef(1);

  const generateKey = useCallback(() => {
    return `draft_key_${nextKeyRef.current++}_${Date.now()}`;
  }, []);

  // Sync draft from data or auto-enter edit mode if empty and canEdit
  useEffect(() => {
    if (!isEditing) {
      if (data.length === 0 && canEdit) {
        setIsEditing(true);
        setDraft([{ _clientKey: generateKey(), data: createEmptyRow() }]);
      } else {
        setDraft(
          data.map((item) => ({
            _clientKey: item.id ? `id_${item.id}` : generateKey(),
            data: { ...item },
          }))
        );
      }
    }
  }, [data, canEdit, isEditing, createEmptyRow, generateKey]);

  const handleStartEdit = () => {
    if (data.length === 0) {
      setDraft([{ _clientKey: generateKey(), data: createEmptyRow() }]);
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
    if (data.length === 0) {
      setDraft([{ _clientKey: generateKey(), data: createEmptyRow() }]);
    } else {
      setDraft(
        data.map((item) => ({
          _clientKey: item.id ? `id_${item.id}` : generateKey(),
          data: { ...item },
        }))
      );
      setIsEditing(false);
    }
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
    setDraft((prev) => [...prev, { _clientKey: generateKey(), data: createEmptyRow() }]);
  };

  const handleDeleteRow = (index: number) => {
    setDraft((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        return [{ _clientKey: generateKey(), data: createEmptyRow() }];
      }
      return next;
    });
  };

  // Count changes compared to original data
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
      // Keep draft on error so user doesn't lose inputs
    } finally {
      setIsSaving(false);
    }
  };

  const rowsToDisplay = isEditing ? draft : data.map((d) => ({ _clientKey: `view_${d.id}`, data: d }));

  return (
    <div className={cn('space-y-4', className)}>
      {/* Table Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-200 dark:border-gray-800">
        <div>
          {title && <h3 className="text-base sm:text-lg font-black text-sec dark:text-white">{title}</h3>}
          {subtitle && <p className="text-xs text-ink-normal/60 dark:text-gray-400 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {extraHeaderActions && isEditing && extraHeaderActions}
          {canEdit && !isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartEdit}
              className="text-xs font-bold gap-1.5 shadow-hard-sm"
            >
              <Edit2 className="w-3.5 h-3.5 text-primary" />
              <span>ویرایش جدول</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Table Container */}
      <Card className="overflow-hidden border-2 border-primary/20 shadow-hard p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 dark:bg-[#182030] border-b-2 border-primary/20 text-ink-normal/80 dark:text-gray-200 font-black">
                <th className="py-3 px-3 w-12 text-center">#</th>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    style={{ width: col.width }}
                    className={cn(
                      'py-3 px-3.5 whitespace-nowrap',
                      col.isSticky && 'sticky start-0 bg-gray-100 dark:bg-[#182030] z-20 shadow-[2px_0_0_#00000010]'
                    )}
                  >
                    {col.header}
                  </th>
                ))}
                {isEditing && <th className="py-3 px-3 w-12 text-center">عملیات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
              {rowsToDisplay.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (isEditing ? 2 : 1)} className="py-12 text-center text-ink-normal/50 dark:text-gray-400 font-bold">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                rowsToDisplay.map((rowItem, rowIndex) => {
                  const isLastRow = rowIndex === rowsToDisplay.length - 1;
                  return (
                    <tr
                      key={rowItem._clientKey}
                      className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors"
                    >
                      {/* Row Index */}
                      <td className="py-2.5 px-3 text-center text-ink-normal/50 dark:text-gray-400 font-bold text-[11px]">
                        {toPersianDigits(rowIndex + 1)}
                      </td>

                      {/* Cells */}
                      {columns.map((col, colIndex) => {
                        const isLastCell = isLastRow && colIndex === columns.length - 1;
                        return (
                          <td
                            key={col.id}
                            className={cn(
                              'py-2 px-3',
                              col.isSticky && 'sticky start-0 bg-white dark:bg-[#121824] z-10 font-bold shadow-[2px_0_0_#00000010]'
                            )}
                          >
                            {isEditing && col.renderEdit ? (
                              col.renderEdit(
                                rowItem.data,
                                rowIndex,
                                (updated) => handleRowChange(rowIndex, updated),
                                isLastCell,
                                isLastCell ? handleAddRow : undefined
                              )
                            ) : (
                              col.renderView(rowItem.data, rowIndex)
                            )}
                          </td>
                        );
                      })}

                      {/* Delete action in edit mode */}
                      {isEditing && (
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(rowIndex)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="حذف ردیف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Append Row Button inside table footer in edit mode */}
        {isEditing && (
          <div className="p-3 bg-gray-50 dark:bg-[#151C28] border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRow}
              className="text-xs font-bold gap-1.5 py-1.5 shadow-hard-sm"
            >
              <Plus className="w-3.5 h-3.5 text-primary" />
              <span>افزودن ردیف جدید (Tab در آخرین سلول)</span>
            </Button>
            <span className="text-[11px] text-ink-normal/50 dark:text-gray-400 font-bold">
              ردیف‌های کاملاً خالی هنگام ذخیره نادیده گرفته می‌شوند
            </span>
          </div>
        )}
      </Card>

      {/* Sticky Bottom Save / Cancel Bar in Edit Mode */}
      {isEditing && (
        <div className="sticky bottom-4 z-40 bg-white/95 dark:bg-[#151C28]/95 backdrop-blur-md p-3.5 rounded-2xl border-2 border-primary/40 shadow-hard-lg flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs sm:text-sm font-black text-sec dark:text-white">
              در حال ویرایش جدول
            </span>
            {changeCount > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold">
                {toPersianDigits(changeCount)} تغییر
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isSaving}
              className="text-xs font-bold gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>انصراف</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              isLoading={isSaving}
              disabled={changeCount === 0 || isSaving}
              className="text-xs font-extrabold gap-1.5 shadow-hard-sm"
            >
              <Check className="w-3.5 h-3.5" />
              <span>ذخیره {changeCount > 0 ? `(${toPersianDigits(changeCount)} تغییر)` : ''}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
