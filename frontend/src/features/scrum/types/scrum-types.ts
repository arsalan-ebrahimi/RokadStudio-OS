export type ScrumColor = 'ECOSYSTEM' | 'MALE' | 'FEMALE' | 'COLLEGE' | 'CLUB';

export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED';

export type ItemStatus = 'TODO' | 'DOING' | 'DONE';

export type EventScheduleType = 'WEEKLY' | 'ONCE';

export type ScrumRole = 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER';

export type LeaderboardPeriod = 'SPRINT' | 'MONTH' | 'ALL';

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

export interface ScrumMember extends ScrumUserRef {
  label?: string | null;
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
  admins: ScrumUserRef[];
  memberCount?: number;
  myRole?: ScrumRole;
  canEdit?: boolean;
  permissions?: ScrumPermissions;
  activeSprint?: { id: number; number: number; title: string } | null;
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
  completedAt?: string | null;
  totalPoints: number;
  donePoints: number;
  itemCount: number;
  totalTrackedSeconds?: number;
  projects?: SprintProject[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SprintProject {
  id: number;
  sprintId: number;
  projectId?: number | null;
  project?: { id: number; name: string } | null;
  name: string;
  points: number;
  status: ItemStatus;
  sortOrder: number;
  assignee?: ScrumUserRef | null;
  totalTrackedSeconds?: number;
  sessionCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScrumLinkedProject {
  id: number;
  name: string;
  description?: string | null;
  isActive: boolean;
  members: ScrumUserRef[];
  trackedSeconds?: {
    approved: number;
    pending: number;
  };
}

export interface AvailableScrumProject {
  id: number;
  name: string;
  description?: string | null;
  isActive: boolean;
  memberCount: number;
}

export interface ScrumKpi {
  id?: number;
  scrumId?: number;
  indicator?: string | null;
  formula?: string | null;
  strategicGoal?: string | null;
  unit?: string | null;
  target?: number | null;
  firstMonthTarget?: number | null;
  actualValue?: number | null;
  minExpected?: number | null;
  sortOrder?: number;
  progressPercent?: number | null;
  status?: 'BELOW_MIN' | 'IN_RANGE' | 'ON_TARGET' | null;
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
  kind: 'STUDIO' | 'SPRINT';
  id: number;
  label?: string;
  name: string;
  pathLabel?: string;
  points?: number;
  status?: ItemStatus;
  scrum?: { id: number; name: string; color: ScrumColor };
  sprint?: { id: number; number: number; title: string };
}

export interface WorkTargetsScrumGroup {
  scrum: { id: number; name: string; color: ScrumColor };
  sprint: { id: number; number: number; title: string } | null;
  items: { id: number; name: string; points: number; status: ItemStatus }[];
  projects: { id: number; name: string }[];
}

export interface WorkTargetsResponse {
  recent: WorkTarget[];
  scrums: WorkTargetsScrumGroup[];
  studioProjects: { id: number; name: string; description?: string | null }[];
}

export interface ScrumReportRow {
  kind: 'SPRINT_ITEM' | 'PROJECT';
  member: ScrumUserRef | null;
  item: {
    id: number;
    name: string;
    points: number;
    status: ItemStatus;
    sprint: { id: number; number: number; title: string };
  } | null;
  project: { id: number; name: string } | null;
  sessionCount: number;
  totalSeconds: number;
  secondsPerPoint: number | null;
}

export interface ScrumReportData {
  rows: ScrumReportRow[];
  sprintAggregates: {
    sprintId: number;
    sprintNumber: number;
    sprintTitle: string;
    totalPoints: number;
    donePoints: number;
    totalSeconds: number;
    sessionCount: number;
  }[];
  total: {
    totalPoints: number;
    donePoints: number;
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
}

export interface ScrumLeaderboardData {
  period: LeaderboardPeriod;
  range: { from: string; to: string } | null;
  sprint: { id: number; number: number; title: string } | null;
  rows: ScrumLeaderboardRow[];
  me: {
    rank: number | null;
    approvedSeconds: number;
    pendingSeconds: number;
  };
}

export interface ScrumAdminDashboardScrum {
  id: number;
  name: string;
  color: ScrumColor;
  memberCount: number;
  linkedProjectCount: number;
  activeSprint: {
    id: number;
    number: number;
    title: string;
    endDate: string | null;
    totalPoints: number;
    donePoints: number;
    openItems: number;
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
    openItems: number;
    donePoints: number;
    totalPoints: number;
  };
  scrums: ScrumAdminDashboardScrum[];
  todayEvents: ScrumAdminDashboardEvent[];
}
