import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Layers,
  ListChecks,
  ArrowLeft,
  MoreVertical,
  Edit2,
  Shield,
  Archive,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Card, Badge, AvatarStack } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import { toPersianDigits } from '@/shared/lib/formatters';
import { SCRUM_COLOR_MAP, type Scrum } from '../types/scrum-types';

interface ScrumCardProps {
  scrum: Scrum;
  basePath?: string;
  showManagementMenu?: boolean;
  onEdit?: (scrum: Scrum) => void;
  onManageAdmins?: (scrum: Scrum) => void;
  onToggleArchive?: (scrum: Scrum) => void;
  onDelete?: (scrum: Scrum) => void;
}

export const ScrumCard: React.FC<ScrumCardProps> = ({
  scrum,
  basePath = '/panel/scrums',
  showManagementMenu = false,
  onEdit,
  onManageAdmins,
  onToggleArchive,
  onDelete,
}) => {
  const colorMeta = SCRUM_COLOR_MAP[scrum.color] || SCRUM_COLOR_MAP.ECOSYSTEM;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const permissions = scrum.permissions;
  const canShowMenu =
    showManagementMenu &&
    Boolean(
      permissions?.canEditContent ||
        permissions?.canManageAdmins ||
        permissions?.canArchive
    );

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [menuOpen]);

  return (
    <Card
      hoverable
      className={cn(
        'h-full relative overflow-visible rounded-3xl p-5 flex flex-col justify-between group',
        !scrum.isActive && 'opacity-80 bg-gray-50/80 dark:bg-[#111722]'
      )}
    >
      {/* Top Color Band */}
      <div
        className={cn(
          'absolute top-0 inset-x-0 h-2.5 rounded-t-[22px]',
          colorMeta.solidBg
        )}
      />

      <div className="space-y-3 mt-1.5">
        {/* Header Row: Title Link + Status Badge + Menu Button */}
        <div className="flex items-start justify-between gap-2">
          <Link
            to={`${basePath}/${scrum.id}`}
            className="min-w-0 flex-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-sec dark:focus-visible:ring-primary"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn('w-3 h-3 rounded-full shrink-0', colorMeta.solidBg)} />
              <h3 className="text-base font-black text-sec dark:text-white group-hover:text-primary transition-colors truncate">
                {scrum.name}
              </h3>
            </div>
          </Link>

          <div className="flex items-center gap-1.5 shrink-0">
            <Badge dot variant={scrum.isActive ? 'ecosystem' : 'neutral'}>
              {scrum.isActive ? 'فعال' : 'بایگانی'}
            </Badge>

            {canShowMenu && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="w-9 h-9 -m-1 rounded-xl flex items-center justify-center text-sec/65 dark:text-gray-300 hover:bg-sec/[0.06] dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  aria-label="عملیات اسکرام"
                  aria-expanded={menuOpen}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute end-0 top-full mt-1 z-30 w-44 rounded-2xl border-[1.5px] border-sec dark:border-primary/45 bg-white dark:bg-[#151C28] shadow-male p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100"
                  >
                    {permissions?.canEditContent && onEdit && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          onEdit(scrum);
                        }}
                        className="w-full min-h-[38px] px-2.5 py-2 rounded-xl text-xs font-bold text-start text-sec dark:text-gray-200 hover:bg-sec/[0.05] dark:hover:bg-gray-800 flex items-center gap-2 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>ویرایش</span>
                      </button>
                    )}

                    {permissions?.canManageAdmins && onManageAdmins && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          onManageAdmins(scrum);
                        }}
                        className="w-full min-h-[38px] px-2.5 py-2 rounded-xl text-xs font-bold text-start text-sec dark:text-gray-200 hover:bg-sec/[0.05] dark:hover:bg-gray-800 flex items-center gap-2 cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5 text-club-normal shrink-0" />
                        <span>مدیریت ادمین‌ها</span>
                      </button>
                    )}

                    {permissions?.canArchive && onToggleArchive && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          onToggleArchive(scrum);
                        }}
                        className="w-full min-h-[38px] px-2.5 py-2 rounded-xl text-xs font-bold text-start text-sec dark:text-gray-200 hover:bg-sec/[0.05] dark:hover:bg-gray-800 flex items-center gap-2 cursor-pointer"
                      >
                        {scrum.isActive ? (
                          <>
                            <Archive className="w-3.5 h-3.5 text-college-dark shrink-0" />
                            <span>بایگانی</span>
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>فعال‌سازی</span>
                          </>
                        )}
                      </button>
                    )}

                    {permissions?.canManageAdmins && permissions?.canArchive && onDelete && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete(scrum);
                        }}
                        className="w-full min-h-[38px] px-2.5 py-2 rounded-xl text-xs font-bold text-start text-[#C60036] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span>حذف اسکرام</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Clickable Body Content */}
        <Link to={`${basePath}/${scrum.id}`} className="block space-y-3 focus:outline-none">
          {scrum.description && (
            <p className="text-xs text-sec/65 dark:text-gray-400 line-clamp-2 leading-relaxed">
              {scrum.description}
            </p>
          )}

          {/* Active Sprint Pill */}
          <div className="pt-1 flex items-center justify-between gap-2 text-xs font-bold text-sec/80 dark:text-gray-300">
            <div className="flex items-center gap-2 min-w-0">
              <Layers className="w-4 h-4 text-primary shrink-0" />
              {scrum.activeSprint ? (
                <span className="truncate">
                  <span className="font-mono text-sec dark:text-primary font-black me-1">
                    S{toPersianDigits(scrum.activeSprint.number)}
                  </span>
                  <span>· {scrum.activeSprint.title}</span>
                </span>
              ) : (
                <span className="text-sec/45 dark:text-gray-500">بدون اسپرینت فعال</span>
              )}
            </div>
            {scrum.activeSprint && typeof scrum.activeSprint.progressPercent === 'number' && (
              <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-ecosystem-light dark:bg-ecosystem-darker/60 text-sec dark:text-ecosystem-light shrink-0 tabular-nums">
                {toPersianDigits(scrum.activeSprint.progressPercent)}٪
              </span>
            )}
          </div>

          {/* Admins Stack */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] font-bold text-sec/60 dark:text-gray-400">
              ادمین‌ها:
            </span>
            <AvatarStack
              users={scrum.admins || []}
              max={4}
              size="sm"
              emptyLabel="تعیین نشده"
            />
          </div>
        </Link>
      </div>

      {/* Footer Meta Link */}
      <Link
        to={`${basePath}/${scrum.id}`}
        className="pt-3.5 mt-4 border-t border-sec/10 dark:border-gray-800 flex items-center justify-between text-xs font-bold text-sec/70 dark:text-gray-400 focus:outline-none"
      >
        <div className="flex items-center gap-3 tabular-nums">
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-sec/45 dark:text-gray-500" />
            <span>{toPersianDigits(scrum.memberCount || 0)} عضو</span>
          </span>
          {typeof scrum.taskCount === 'number' && (
            <span className="flex items-center gap-1">
              <ListChecks className="w-3.5 h-3.5 text-sec/45 dark:text-gray-500" />
              <span>{toPersianDigits(scrum.taskCount)} تسک</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-sec dark:text-primary font-black group-hover:-translate-x-1 transition-transform">
          <span>مشاهده اسکرام</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </div>
      </Link>
    </Card>
  );
};
