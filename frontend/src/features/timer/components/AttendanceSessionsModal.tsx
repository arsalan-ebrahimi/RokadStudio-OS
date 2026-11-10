import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, Trash2, Clock, FolderKanban } from 'lucide-react';
import { Modal, Button, Skeleton, EmptyState, toast } from '@/shared/ui';
import { SessionBadge } from './SessionBadge';
import { SessionDecisionDialog } from './SessionDecisionDialog';
import { DeleteSessionDialog } from './DeleteSessionDialog';
import { fetchAdminWorkSessions, decideWorkSession, deleteWorkSession } from '../api/timer-api';
import { formatDurationToHoursMins } from '@/shared/lib/formatters';
import { formatToJalali } from '@/shared/lib/date';
import type { WorkSession } from '@/shared/types/models';

interface AttendanceSessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number | null;
  userName: string;
  date: string;
}

export const AttendanceSessionsModal: React.FC<AttendanceSessionsModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName,
  date,
}) => {
  const queryClient = useQueryClient();
  const [activeDecision, setActiveDecision] = useState<{ id: number; decision: 'APPROVED' | 'REJECTED'; info: string } | null>(null);
  const [deletingSession, setDeletingSession] = useState<{ id: number; info: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-work-sessions', userId, date],
    queryFn: () => fetchAdminWorkSessions({ userId: userId || undefined, date }),
    enabled: isOpen && Boolean(userId) && Boolean(date),
  });

  const decideMut = useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: 'APPROVED' | 'REJECTED' }) =>
      decideWorkSession(id, decision),
    onMutate: async ({ id, decision }) => {
      setActiveDecision(null);
      queryClient.setQueriesData({ queryKey: ['admin-work-sessions'] }, (old: any) => {
        if (!old?.data?.sessions) return old;
        return {
          ...old,
          data: {
            ...old.data,
            sessions: old.data.sessions.map((s: WorkSession) =>
              s.id === id ? { ...s, approval: decision } : s
            ),
          },
        };
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-work-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['reports-summary'] });
      toast.success('وضعیت سشن با موفقیت تغییر کرد');
    },
    onError: (err: Error) => {
      queryClient.invalidateQueries({ queryKey: ['admin-work-sessions'] });
      toast.error(err.message || 'خطا در ثبت وضعیت سشن');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteWorkSession(id),
    onMutate: async (deletedId: number) => {
      setDeletingSession(null);
      queryClient.setQueriesData({ queryKey: ['admin-work-sessions'] }, (old: any) => {
        if (!old?.data?.sessions) return old;
        const remaining = old.data.sessions.filter((s: WorkSession) => s.id !== deletedId);
        const validRemaining = remaining.filter((s: WorkSession) => s.approval !== 'REJECTED');
        return {
          ...old,
          data: {
            ...old.data,
            totalSeconds: validRemaining.reduce((acc: number, s: WorkSession) => acc + s.durationSeconds, 0),
            sessions: remaining,
          },
        };
      });
    },
    onSuccess: () => {
      toast.success('سشن کاری با موفقیت حذف شد');
      queryClient.invalidateQueries({ queryKey: ['admin-work-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['reports-summary'] });
    },
    onError: (err: Error) => {
      queryClient.invalidateQueries({ queryKey: ['admin-work-sessions'] });
      toast.error(err.message || 'خطا در حذف سشن کاری');
    },
  });

  const sessions = data?.data?.sessions || [];

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`سشن‌های کاری ${userName} - ${formatToJalali(date)}`}
        className="max-w-xl"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pe-1">
          {isLoading ? (
            <div className="space-y-2.5">
              {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : sessions.length === 0 ? (
            <EmptyState title="هیچ سشن کاری برای این تاریخ ثبت نشده است" />
          ) : (
            <div className="space-y-2.5">
              {sessions.map((s: WorkSession) => {
                const projectTitle = s.project?.name || s.projectName || 'پروژه';
                const sessionInfo = `${projectTitle} (${formatDurationToHoursMins(s.durationSeconds)})`;

                return (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-2xl border-[1.5px] border-sec/20 dark:border-gray-700 bg-[#F8FAFC] dark:bg-[#182030] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <FolderKanban className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-xs font-black text-sec dark:text-white truncate">{projectTitle}</span>
                        <SessionBadge approval={s.approval} />
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-sec/65 dark:text-gray-400 font-bold tabular-nums">
                        <span className="flex items-center gap-1 text-sec dark:text-primary font-black">
                          <Clock className="w-3.5 h-3.5 text-primary" />
                          {formatDurationToHoursMins(s.durationSeconds)}
                        </span>
                        <span>•</span>
                        <span>{s.startedAt ? new Date(s.startedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t border-sec/10 dark:border-gray-700 sm:border-0">
                      {s.approval !== 'APPROVED' && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => setActiveDecision({ id: s.id, decision: 'APPROVED', info: sessionInfo })}
                          className="text-xs font-bold"
                        >
                          <Check className="w-3.5 h-3.5 me-1" />
                          {s.approval === 'REJECTED' ? 'تغییر به تایید' : 'تایید'}
                        </Button>
                      )}
                      {s.approval !== 'REJECTED' && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setActiveDecision({ id: s.id, decision: 'REJECTED', info: sessionInfo })}
                          className="text-xs font-bold"
                        >
                          <X className="w-3.5 h-3.5 me-1" />
                          {s.approval === 'APPROVED' ? 'تغییر به رد' : 'رد'}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[#C60036] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-300 dark:border-rose-900/50 text-xs font-bold"
                        onClick={() => setDeletingSession({ id: s.id, info: sessionInfo })}
                        aria-label="حذف سشن"
                      >
                        <Trash2 className="w-3.5 h-3.5 me-1" />
                        <span>حذف</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      <SessionDecisionDialog
        isOpen={Boolean(activeDecision)}
        decision={activeDecision?.decision || null}
        targetInfo={activeDecision?.info || ''}
        isLoading={decideMut.isPending}
        onConfirm={() => activeDecision && decideMut.mutate(activeDecision)}
        onCancel={() => setActiveDecision(null)}
      />

      <DeleteSessionDialog
        isOpen={Boolean(deletingSession)}
        targetInfo={deletingSession?.info || ''}
        isLoading={deleteMut.isPending}
        onConfirm={() => deletingSession && deleteMut.mutate(deletingSession.id)}
        onCancel={() => setDeletingSession(null)}
      />
    </>
  );
};
