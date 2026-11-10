import type {
  ApprovalStatus,
  AttendanceTotals,
  DecisionSource,
  PerformanceLevel,
  ScrumBrief,
  StudioPerformanceInfo,
} from '@/shared/types/models';
import type { PaginationMeta } from '@/shared/types/api';

export type { PerformanceLevel, StudioPerformanceInfo, AttendanceTotals };

export type MemberIdParam = number | 'me';

export const PERFORMANCE_LEVELS: readonly PerformanceLevel[] = [
  'EXCELLENT',
  'STRONG',
  'AVERAGE',
  'WEAK',
  'NEEDS_ATTENTION',
] as const;

export interface PerformanceLevelMeta {
  level: PerformanceLevel;
  label: string;
  description: string;
  badgeClass: string;
  dotClass: string;
  activeCardClass: string;
}

export const PERFORMANCE_META: Record<PerformanceLevel, PerformanceLevelMeta> = {
  EXCELLENT: {
    level: 'EXCELLENT',
    label: 'عالی',
    description: 'عملکرد فراتر از انتظار، پیگیری مستمر و خروجی بسیار مطلوب',
    badgeClass:
      'bg-ecosystem-light dark:bg-ecosystem-darker/70 text-[#006B48] dark:text-ecosystem-light border-ecosystem-normal/50',
    dotClass: 'bg-[#007A52] dark:bg-emerald-400',
    activeCardClass:
      'bg-ecosystem-light dark:bg-ecosystem-darker/60 text-sec dark:text-ecosystem-light border-sec dark:border-primary shadow-hard-sm',
  },
  STRONG: {
    level: 'STRONG',
    label: 'قوی',
    description: 'روند منظم، انجام باکیفیت تسک‌ها و همراهی خوب با تیم',
    badgeClass:
      'bg-male-light dark:bg-male-darker/60 text-male-normal dark:text-blue-200 border-male-normal/35',
    dotClass: 'bg-male-normal dark:bg-blue-400',
    activeCardClass:
      'bg-male-light dark:bg-male-darker/55 text-male-normal dark:text-blue-100 border-male-normal dark:border-blue-400 shadow-hard-sm',
  },
  AVERAGE: {
    level: 'AVERAGE',
    label: 'متوسط',
    description: 'عملکرد قابل قبول در حد استاندارد، دارای ظرفیت برای رشد بیشتر',
    badgeClass:
      'bg-gray-100 dark:bg-gray-800 text-sec dark:text-gray-200 border-gray-300 dark:border-gray-600',
    dotClass: 'bg-gray-500 dark:bg-gray-400',
    activeCardClass:
      'bg-gray-100 dark:bg-gray-800 text-sec dark:text-white border-sec dark:border-gray-400 shadow-hard-sm',
  },
  WEAK: {
    level: 'WEAK',
    label: 'ضعیف',
    description: 'کمتر از حد انتظار، نیازمند پیگیری نزدیک‌تر و رفع موانع',
    badgeClass:
      'bg-college-light dark:bg-college-darker/60 text-[#704A0D] dark:text-amber-200 border-college-normal/50',
    dotClass: 'bg-college-normal',
    activeCardClass:
      'bg-college-light dark:bg-college-darker/55 text-[#704A0D] dark:text-amber-200 border-college-normal shadow-hard-sm',
  },
  NEEDS_ATTENTION: {
    level: 'NEEDS_ATTENTION',
    label: 'نیازمند توجه',
    description: 'وضعیت حساس که نیاز به گفت‌وگو، بازنگری وظایف یا اقدام فوری دارد',
    badgeClass:
      'bg-female-light dark:bg-female-darker/60 text-[#A81344] dark:text-rose-200 border-female-normal/45',
    dotClass: 'bg-[#C60036] dark:bg-rose-400',
    activeCardClass:
      'bg-female-light dark:bg-female-darker/55 text-[#A81344] dark:text-rose-200 border-[#C60036] dark:border-rose-400 shadow-hard-sm',
  },
};

export interface MemberProfileMembership {
  scrum: ScrumBrief;
  label: string | null;
  performance?: PerformanceLevel | null;
  performanceNote?: string | null;
  performanceUpdatedAt?: string | null;
}

export interface MemberProfile {
  id: number;
  name: string;
  memberships: MemberProfileMembership[];
  studioPerformance?: StudioPerformanceInfo | null;
  attendanceTotals: AttendanceTotals;
}

export type MemberCalendarDayState =
  | 'PRESENT_APPROVED'
  | 'PRESENT_PENDING'
  | 'ABSENT'
  | 'REJECTED'
  | 'NONE';

export interface MemberCalendarDay {
  date: string;
  state: MemberCalendarDayState;
  sessionCount: number;
  taskCount: number;
  projectCount: number;
}

export interface MemberCalendarResponse {
  days: MemberCalendarDay[];
  totals: AttendanceTotals;
}

export interface MemberDaySessionTargetTask {
  kind: 'TASK';
  id: number;
  name: string;
  scrum: ScrumBrief;
  sprint: { id: number; number: number } | null;
}

export interface MemberDaySessionTargetProject {
  kind: 'PROJECT';
  id: number | null;
  name: string;
}

export type MemberDaySessionTarget =
  | MemberDaySessionTargetTask
  | MemberDaySessionTargetProject;

export interface MemberDaySession {
  id: number;
  createdAt: string;
  durationSeconds: number;
  approval: ApprovalStatus;
  target: MemberDaySessionTarget;
}

export interface MemberDayTaskBreakdown {
  task: { id: number; name: string };
  scrum: ScrumBrief;
  sprint: { id: number; number: number; title: string } | null;
  points: number;
  sessionCount: number;
  totalSeconds: number;
}

export interface MemberDayProjectBreakdown {
  project: { id: number; name: string };
  sessionCount: number;
  totalSeconds: number;
}

export interface MemberDayAttendance {
  state: MemberCalendarDayState;
  source: DecisionSource;
  workNote: string | null;
  workNoteAt: string | null;
}

export interface MemberDayResponse {
  date: string;
  attendance: MemberDayAttendance | null;
  sessions: MemberDaySession[];
  tasks: MemberDayTaskBreakdown[];
  projects: MemberDayProjectBreakdown[];
}

export interface MemberWorkTaskBreakdown extends MemberDayTaskBreakdown {
  approvedSeconds: number;
  pendingSeconds: number;
  rejectedSeconds?: number;
}

export interface MemberWorkProjectBreakdown extends MemberDayProjectBreakdown {
  approvedSeconds: number;
  pendingSeconds: number;
  rejectedSeconds?: number;
}

export interface MemberWorkSessionItem extends MemberDaySession {
  workDate: string;
  source: DecisionSource;
}

export interface MemberWorkTotals {
  totalSeconds: number;
  approvedSeconds: number;
  pendingSeconds: number;
  rejectedSeconds: number;
  sessionCount: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
}

export interface MemberWorkResponse {
  tasks: MemberWorkTaskBreakdown[];
  projects: MemberWorkProjectBreakdown[];
  sessions: {
    items: MemberWorkSessionItem[];
    meta: PaginationMeta;
  };
  totals: MemberWorkTotals;
}

export interface MemberWorkQuery {
  from?: string;
  to?: string;
  scrumId?: number;
  sprintId?: number;
  projectId?: number;
  approval?: ApprovalStatus | 'ALL';
  page?: number;
  limit?: number;
}

