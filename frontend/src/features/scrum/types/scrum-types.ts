export type ScrumColor = 'ECOSYSTEM' | 'MALE' | 'FEMALE' | 'COLLEGE' | 'CLUB';

export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED';

export type ItemStatus = 'TODO' | 'DOING' | 'DONE';

export type EventScheduleType = 'WEEKLY' | 'ONCE';

export const SCRUM_COLOR_MAP: Record<ScrumColor, { bg: string; text: string; border: string; accent: string; label: string }> = {
  ECOSYSTEM: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-300 dark:border-emerald-700',
    accent: '#59BBAF',
    label: 'اکوسیستم (فیروزه‌ای)',
  },
  MALE: {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-300 dark:border-blue-700',
    accent: '#2D68C4',
    label: 'پسرانه (آبی)',
  },
  FEMALE: {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-300 dark:border-rose-700',
    accent: '#E0195B',
    label: 'دخترانه (صورتی)',
  },
  COLLEGE: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-700',
    accent: '#FF9F1C',
    label: 'کالج (نارنجی)',
  },
  CLUB: {
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-300 dark:border-purple-700',
    accent: '#7B2CBF',
    label: 'باشگاه (بنفش)',
  },
};

export interface ScrumMember {
  id: number;
  name: string;
  label?: string | null;
}

export interface Scrum {
  id: number;
  name: string;
  description?: string | null;
  color: ScrumColor;
  isActive: boolean;
  ownerId: number;
  memberCount?: number;
  canEdit?: boolean;
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
  name: string;
  points: number;
  status: ItemStatus;
  sortOrder: number;
  assignee?: { id: number; name: string } | null;
  totalTrackedSeconds?: number;
  sessionCount?: number;
  createdAt?: string;
  updatedAt?: string;
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
  label: string;
  name: string;
  pathLabel?: string;
  points?: number;
  status?: ItemStatus;
  scrum?: { id: number; name: string; color: ScrumColor };
  sprint?: { id: number; number: number; title: string };
}

export interface WorkTargetsResponse {
  recent: WorkTarget[];
  scrums: {
    scrum: { id: number; name: string; color: ScrumColor };
    sprint: { id: number; number: number; title: string };
    items: { id: number; name: string; points: number; status: ItemStatus }[];
  }[];
  studioProjects: { id: number; name: string; description?: string | null }[];
}

export interface ScrumReportRow {
  member: { id: number; name: string } | null;
  item: {
    id: number;
    name: string;
    points: number;
    status: ItemStatus;
    sprint: { id: number; number: number; title: string };
  };
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

