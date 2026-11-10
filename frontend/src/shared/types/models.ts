export type Role = 'USER' | 'ADMIN' | 'SUPER_ADMIN' | 'SCRUM_ADMIN';

export type AttendanceStatus = 'PRESENT' | 'ABSENT';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type DecisionSource = 'USER' | 'ADMIN' | 'SYSTEM';

export type PerformanceLevel =
  | 'EXCELLENT'
  | 'STRONG'
  | 'AVERAGE'
  | 'WEAK'
  | 'NEEDS_ATTENTION';

export interface StudioPerformanceInfo {
  level: PerformanceLevel;
  note: string | null;
  updatedAt: string;
}

export interface AttendanceTotals {
  present: number;
  pending: number;
  absent: number;
}

export interface User {
  id: number;
  code?: string;
  name: string;
  role: Role;
  isActive?: boolean;
  createdAt?: string;
  administeredScrumCount?: number;
  memberScrumCount?: number;
  studioPerformance?: StudioPerformanceInfo | null;
  attendanceTotals?: AttendanceTotals;
}

export type ScrumColor = 'ECOSYSTEM' | 'MALE' | 'FEMALE' | 'COLLEGE' | 'CLUB';

export type WorkTargetKind = 'PROJECT' | 'TASK';

export interface ScrumBrief {
  id: number;
  name: string;
  color: ScrumColor;
  isActive?: boolean;
}

export interface Project {
  id: number;
  name: string;
  description?: string | null;
  isActive?: boolean;
  memberCount?: number;
  createdAt?: string;
}

export interface SprintBrief {
  id: number;
  number: number;
  title: string;
  status?: 'PLANNED' | 'ACTIVE' | 'COMPLETED';
}

export interface TaskSummary {
  id: number;
  name: string;
  points?: number;
  scrum?: ScrumBrief | null;
  sprint?: SprintBrief | null;
}

export interface Attendance {
  id: number;
  userId?: number;
  date: string;
  status: AttendanceStatus;
  effectiveStatus: AttendanceStatus;
  approval: ApprovalStatus;
  source: DecisionSource;
  decidedById?: number | null;
  decidedAt?: string | null;
  reason?: string | null;
  workNote?: string | null;
  workNoteAt?: string | null;
  workNotePrompted?: boolean;
  scrums?: ScrumBrief[];
  sessionsCount?: number;
  totalSeconds?: number;
  canDecide?: boolean;
  user?: { id: number; name: string; role?: Role };
}

export interface AttendanceImpact {
  sessionCount: number;
  totalSeconds?: number;
  taskSessionCount: number;
  projectSessionCount: number;
  alreadyRejected?: boolean;
}

export interface WorkSession {
  id: number;
  userId?: number;
  targetType?: WorkTargetKind;
  projectId?: number | null;
  taskId?: number | null;
  projectName?: string;
  durationSeconds: number;
  clientRequestId?: string;
  workDate?: string;
  attendanceDate?: string;
  approval: ApprovalStatus;
  source?: DecisionSource;
  decidedBy?: { id: number; name: string } | null;
  decidedAt?: string | null;
  startedAt?: string | null;
  createdAt: string;
  user?: { id: number; name: string; role?: Role };
  project?: Pick<Project, 'id' | 'name'> | null;
  task?: TaskSummary | null;
  canModerate?: boolean;
  canDelete?: boolean;
}

export interface WorkSessionSummaryRow {
  totalSeconds: number;
  sessionsCount: number;
  targetType?: WorkTargetKind;
  user?: { id: number; name: string };
  project?: { id: number; name: string } | null;
  task?: TaskSummary | null;
}

export interface WorkSessionTargetProject {
  id: number;
  name: string;
  isActive: boolean;
}

export interface WorkSessionTargetTask {
  id: number;
  name: string;
  isActive: boolean;
  points: number;
  scrumId: number;
  scrumName: string;
  scrumColor: ScrumColor;
}

export interface WorkSessionTargetsResponse {
  projects: WorkSessionTargetProject[];
  tasks: WorkSessionTargetTask[];
}

export interface WorkTargetSessionsTarget {
  kind: WorkTargetKind;
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  points?: number;
  scrum?: ScrumBrief;
  sprint?: SprintBrief | null;
}

export interface WorkTargetSessionsPermissions {
  canViewAllUsers: boolean;
  canModerate: boolean;
  canDelete: boolean;
}

export interface WorkTargetSummaryByUser {
  user: { id: number; name: string };
  totalSeconds: number;
  approvedSeconds: number;
  pendingSeconds: number;
  rejectedSeconds: number;
  sessionCount: number;
}

export interface WorkTargetSessionsSummary {
  totalSeconds: number;
  approvedSeconds: number;
  pendingSeconds: number;
  rejectedSeconds: number;
  sessionCount: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  byUser: WorkTargetSummaryByUser[];
}

export interface WorkTargetSessionsData {
  target: WorkTargetSessionsTarget;
  permissions: WorkTargetSessionsPermissions;
  summary: WorkTargetSessionsSummary;
  sessions: WorkSession[];
}

export interface WorkTargetSessionsQuery {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  approval?: ApprovalStatus | 'ALL';
  userId?: number;
  page?: number;
  limit?: number;
}

