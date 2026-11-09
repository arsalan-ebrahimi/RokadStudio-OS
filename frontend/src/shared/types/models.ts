export type Role = 'USER' | 'ADMIN' | 'SUPER_ADMIN' | 'SCRUM_ADMIN';

export type AttendanceStatus = 'PRESENT' | 'ABSENT';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type DecisionSource = 'USER' | 'ADMIN' | 'SYSTEM';

export interface User {
  id: number;
  code?: string;
  name: string;
  role: Role;
  isActive?: boolean;
  createdAt?: string;
}

export interface Project {
  id: number;
  name: string;
  description?: string | null;
  isActive?: boolean;
  memberCount?: number;
  createdAt?: string;
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
  sessionsCount?: number;
  totalSeconds?: number;
  user?: Pick<User, 'id' | 'name' | 'role'>;
}

export interface WorkSession {
  id: number;
  userId?: number;
  projectId?: number | null;
  sprintProjectId?: number | null;
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
  user?: Pick<User, 'id' | 'name' | 'role'>;
  project?: Pick<Project, 'id' | 'name'> | null;
}

export interface WorkSessionSummaryRow {
  totalSeconds: number;
  sessionsCount: number;
  user?: { id: number; name: string };
  project?: { id: number; name: string };
}

