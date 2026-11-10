import type { AttendanceTotals, PerformanceLevel, Role } from '@/shared/types/models';

export type ScrumColor = 'ECOSYSTEM' | 'MALE' | 'FEMALE' | 'COLLEGE' | 'CLUB';

export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED';

export type EventScheduleType = 'WEEKLY' | 'ONCE';

export type ScrumRole = 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER';

export type LeaderboardPeriod = 'SPRINT' | 'MONTH' | 'ALL';

export type KpiStatus = 'BELOW_MIN' | 'IN_RANGE' | 'ON_TARGET';

export interface ScrumColorMeta {
  bg: string;
  chipBg: string;
  solidBg: string;
  solidText: string;
  barText: string;
  text: string;
  border: string;
  accent: string;
  badgeVariant: 'ecosystem' | 'male' | 'female' | 'college' | 'club';
  label: string;
}

export const SCRUM_COLOR_MAP: Record<ScrumColor, ScrumColorMeta> = {
  ECOSYSTEM: {
    bg: 'bg-ecosystem-light dark:bg-ecosystem-darker/40',
    chipBg: 'bg-ecosystem-light dark:bg-ecosystem-darker/60',
    solidBg: 'bg-ecosystem-normal',
    solidText: 'text-sec',
    barText: 'text-ecosystem-normal',
    text: 'text-sec dark:text-ecosystem-light',
    border: 'border-ecosystem-normal/45 dark:border-ecosystem-normal/50',
    accent: '#59BBAF',
    badgeVariant: 'ecosystem',
    label: 'اکوسیستم (فیروزه‌ای)',
  },
  MALE: {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    chipBg: 'bg-male-light dark:bg-male-darker/60',
    solidBg: 'bg-[#2D68C4]',
    solidText: 'text-white',
    barText: 'text-[#2D68C4]',
    text: 'text-blue-800 dark:text-blue-200',
    border: 'border-blue-300 dark:border-blue-700',
    accent: '#2D68C4',
    badgeVariant: 'male',
    label: 'پسرانه (آبی)',
  },
  FEMALE: {
    bg: 'bg-female-light dark:bg-female-darker/40',
    chipBg: 'bg-female-light dark:bg-female-darker/60',
    solidBg: 'bg-female-normal',
    solidText: 'text-white',
    barText: 'text-female-normal',
    text: 'text-[#A81344] dark:text-rose-200',
    border: 'border-female-normal/40 dark:border-female-normal/50',
    accent: '#E0195B',
    badgeVariant: 'female',
    label: 'دخترانه (صورتی)',
  },
  COLLEGE: {
    bg: 'bg-college-light dark:bg-college-darker/40',
    chipBg: 'bg-college-light dark:bg-college-darker/60',
    solidBg: 'bg-college-normal',
    solidText: 'text-sec',
    barText: 'text-college-normal',
    text: 'text-[#704A0D] dark:text-amber-200',
    border: 'border-college-normal/45 dark:border-college-normal/50',
    accent: '#F8A41D',
    badgeVariant: 'college',
    label: 'کالج (نارنجی)',
  },
  CLUB: {
    bg: 'bg-club-light dark:bg-club-darker/40',
    chipBg: 'bg-club-light dark:bg-club-darker/60',
    solidBg: 'bg-club-normal',
    solidText: 'text-white',
    barText: 'text-club-normal',
    text: 'text-club-normal dark:text-purple-200',
    border: 'border-club-normal/40 dark:border-club-normal/50',
    accent: '#652D90',
    badgeVariant: 'club',
    label: 'باشگاه (بنفش)',
  },
};

export interface ScrumUserRef {
  id: number;
  name: string;
}

export interface ScrumAdminRef extends ScrumUserRef {
  role?: Role;
  isMember?: boolean;
}

export interface ScrumAdminInput {
  userId: number;
  alsoMember: boolean;
}

export interface ScrumMember extends ScrumUserRef {
  label?: string | null;
  isAdmin?: boolean;
  performance?: PerformanceLevel | null;
  performanceNote?: string | null;
  performanceUpdatedAt?: string | null;
  attendanceTotals?: AttendanceTotals;
}

export interface ScrumPermissions {
  canEditContent: boolean;
  canManageAdmins: boolean;
  canArchive: boolean;
}

export interface Scrum {
  id: number;
  name: string;
  description?: string | null;
  color: ScrumColor;
  isActive: boolean;
  admins: ScrumAdminRef[];
  memberCount?: number;
  taskCount?: number;
  myRole?: ScrumRole;
  canEdit?: boolean;
  permissions?: ScrumPermissions;
  activeSprint?: {
    id: number;
    number: number;
    title: string;
    progressPercent?: number;
  } | null;
  members?: ScrumMember[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Sprint {
  id: number;
  scrumId: number;
  number: number;
  title: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: SprintStatus;
  progressPercent: number;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScrumSprintRef {
  id: number;
  number: number;
  title: string;
  status?: SprintStatus;
}

export interface ScrumTask {
  id: number;
  scrumId: number;
  sprintId?: number | null;
  sprint?: {
    id: number;
    number: number;
    title: string;
    status: SprintStatus;
  } | null;
  name: string;
  description?: string | null;
  points: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  members: ScrumUserRef[];
  isAssignedToMe?: boolean;
  trackedSeconds?: {
    approved: number;
    pending: number;
    rejected: number;
  };
}

export interface ScrumKpi {
  id?: number;
  scrumId?: number;
  indicator?: string | null;
  formula?: string | null;
  strategicGoal?: string | null;
  unit?: string | null;
  firstMonthTarget?: string | null;
  target?: string | null;
  finalTarget?: string | null;
  minExpected?: number | null;
  sortOrder?: number;
  progressPercent?: number | null;
  status?: KpiStatus | null;
  updatedAt?: string;
}

export interface ScrumEvent {
  id?: number;
  scrumId?: number;
  name: string;
  scheduleType: EventScheduleType;
  dayOfWeek?: number | null;
  date?: string | null;
  startTime?: string | null;
  durationMinutes?: number | null;
  inputs?: string | null;
  outputs?: string | null;
  sortOrder?: number;
}

export interface TodayScrumEvent {
  id: number;
  scrumId: number;
  scrumName: string;
  scrumColor: ScrumColor;
  name: string;
  scheduleType: EventScheduleType;
  dayOfWeek?: number | null;
  date?: string | null;
  startTime?: string | null;
  durationMinutes?: number | null;
  inputs?: string | null;
  outputs?: string | null;
}

export interface WorkTarget {
  kind: 'PROJECT' | 'TASK';
  id: number;
  label?: string;
  name: string;
  pathLabel?: string;
  points?: number;
  scrum?: { id: number; name: string; color: ScrumColor };
  sprint?: { id: number; number: number; title: string } | null;
}

export interface WorkTargetsScrumGroup {
  scrum: { id: number; name: string; color: ScrumColor };
  sprint: { id: number; number: number; title: string } | null;
  tasks: {
    id: number;
    name: string;
    description?: string | null;
    points: number;
    sprint?: { id: number; number: number; title: string } | null;
  }[];
}

export interface WorkTargetsResponse {
  recent: WorkTarget[];
  scrums: WorkTargetsScrumGroup[];
  studioProjects: { id: number; name: string; description?: string | null }[];
}

export interface ScrumReportRow {
  task: {
    id: number;
    name: string;
    points: number;
    isActive: boolean;
    sprintId?: number | null;
    sprint?: { id: number; number: number; title: string } | null;
  };
  member: ScrumUserRef | null;
  assignedMembersCount: number;
  sessionCount: number;
  totalSeconds: number;
  secondsPerPoint: number | null;
}

export interface ScrumReportData {
  rows: ScrumReportRow[];
  taskAggregates: {
    taskId: number;
    taskName: string;
    points: number;
    isActive: boolean;
    sprintId?: number | null;
    sprint?: { id: number; number: number; title: string } | null;
    memberCount: number;
    totalSeconds: number;
    sessionCount: number;
  }[];
  sprints: Sprint[];
  total: {
    totalTasks: number;
    activeTasks: number;
    totalPoints: number;
    totalSeconds: number;
    sessionCount: number;
  };
}

export interface ScrumLeaderboardRow {
  rank: number;
  user: ScrumUserRef;
  approvedSeconds: number;
  sessionCount: number;
  isMe: boolean;
  isAdmin?: boolean;
  performance?: PerformanceLevel | null;
  performanceNote?: string | null;
  performanceUpdatedAt?: string | null;
  attendanceTotals?: AttendanceTotals;
}

export interface ScrumLeaderboardData {
  period: LeaderboardPeriod;
  range: { from: string; to: string } | null;
  sprint: { id: number; number: number; title: string; status?: SprintStatus } | null;
  rows: ScrumLeaderboardRow[];
  me: {
    rank: number | null;
    approvedSeconds: number;
    pendingSeconds: number;
  };
}

export interface MyScrumTasksQuery {
  scrumId?: number;
  isActive?: boolean;
  search?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface MyScrumOption {
  id: number;
  name: string;
  color: ScrumColor;
  isActive: boolean;
}

export interface MyScrumTaskItem {
  id: number;
  scrumId: number;
  sprintId?: number | null;
  sprint?: {
    id: number;
    number: number;
    title: string;
    status: SprintStatus;
  } | null;
  scrum: {
    id: number;
    name: string;
    color: ScrumColor;
    isActive: boolean;
  };
  name: string;
  description?: string | null;
  points: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  members: ScrumUserRef[];
  isAssignedToMe: boolean;
  trackedSeconds: {
    approved: number;
    pending: number;
    rejected: number;
    total: number;
  };
  sessionCounts: {
    approved: number;
    pending: number;
    rejected: number;
    total: number;
  };
}

export interface MyScrumTasksResponse {
  scrums: MyScrumOption[];
  tasks: MyScrumTaskItem[];
  summary: {
    totalTasks: number;
    activeTasks: number;
    workedTasksCount: number;
    totalPoints: number;
    approvedSeconds: number;
    pendingSeconds: number;
    rejectedSeconds: number;
    totalSeconds: number;
    sessionCount: number;
  };
}

export interface ScrumAdminDashboardScrum {
  id: number;
  name: string;
  color: ScrumColor;
  memberCount: number;
  taskCount: number;
  activeTaskCount: number;
  totalTaskPoints: number;
  activeSprint: {
    id: number;
    number: number;
    title: string;
    endDate: string | null;
    progressPercent: number;
  } | null;
  kpi: {
    total: number;
    belowMin: number;
    inRange: number;
    onTarget: number;
  };
}

export interface ScrumAdminDashboardEvent {
  scrumId: number;
  scrumName: string;
  color: ScrumColor;
  name: string;
  startTime: string | null;
  durationMinutes: number | null;
}

export interface ScrumAdminDashboardData {
  totals: {
    scrums: number;
    members: number;
    activeSprints: number;
    activeTasks: number;
    totalTasks: number;
    totalTaskPoints: number;
  };
  scrums: ScrumAdminDashboardScrum[];
  todayEvents: ScrumAdminDashboardEvent[];
}
