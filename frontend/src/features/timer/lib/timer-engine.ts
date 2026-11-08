import {
  FOCUS_MS,
  BREAK_MS,
  MIN_REGISTERABLE_SECONDS,
} from '../config/timer-constants';

export type TimerStatus = 'IDLE' | 'RUNNING' | 'PAUSED';
export type PomodoroMode = 'FOCUS' | 'BREAK';

export interface WorkState {
  accumulatedMs: number;
  runningSince: number | null;
  segmentStartedAt: string | null;
}

export interface PomodoroState {
  mode: PomodoroMode;
  focusRemainingMs: number;
  breakEndsAt: number | null;
}

export interface TimerEngineState {
  status: TimerStatus;
  projectId: number | null;
  work: WorkState;
  pomodoro: PomodoroState;
  lastHeartbeat: number | null;
}

export interface DerivedTimerState {
  status: TimerStatus;
  projectId: number | null;
  workMs: number;
  workSeconds: number;
  pomodoroMode: PomodoroMode;
  pomodoroRemainingMs: number;
  pomodoroRemainingSeconds: number;
  isBreakActive: boolean;
  canStart: boolean;
  canRegister: boolean;
  mainButtonLabel: 'شروع' | 'توقف' | 'ادامه';
  mainButtonDisabled: boolean;
  mainButtonDisabledReason: string | null;
  registerButtonDisabled: boolean;
  registerButtonDisabledReason: string | null;
  projectSelectLocked: boolean;
}

export function createInitialTimerState(projectId: number | null = null): TimerEngineState {
  return {
    status: 'IDLE',
    projectId,
    work: {
      accumulatedMs: 0,
      runningSince: null,
      segmentStartedAt: null,
    },
    pomodoro: {
      mode: 'FOCUS',
      focusRemainingMs: FOCUS_MS,
      breakEndsAt: null,
    },
    lastHeartbeat: null,
  };
}

export function getDerivedTimerState(state: TimerEngineState, now = Date.now()): DerivedTimerState {
  const isRunning = state.status === 'RUNNING';
  const runningSince = state.work.runningSince;
  const elapsed = isRunning && runningSince ? Math.max(0, now - runningSince) : 0;

  // Work time calculation
  let currentWorkMs = state.work.accumulatedMs;
  if (isRunning) {
    if (state.pomodoro.mode === 'FOCUS') {
      // If elapsed reached focusRemainingMs, it froze at that exact moment
      const effectiveWorkElapsed = Math.min(elapsed, state.pomodoro.focusRemainingMs);
      currentWorkMs += effectiveWorkElapsed;
    }
  }
  const workSeconds = Math.floor(currentWorkMs / 1000);

  // Pomodoro calculation
  let pomodoroRemainingMs = state.pomodoro.focusRemainingMs;
  let isBreakActive = false;

  if (state.pomodoro.mode === 'BREAK') {
    const breakEndsAt = state.pomodoro.breakEndsAt || 0;
    if (now < breakEndsAt) {
      isBreakActive = true;
      pomodoroRemainingMs = Math.max(0, breakEndsAt - now);
    } else {
      // Break has ended
      isBreakActive = false;
      pomodoroRemainingMs = FOCUS_MS;
    }
  } else if (isRunning) {
    pomodoroRemainingMs = Math.max(0, state.pomodoro.focusRemainingMs - elapsed);
  }

  const pomodoroRemainingSeconds = Math.ceil(pomodoroRemainingMs / 1000);

  // Control button labels and enablement
  const mainButtonLabel: 'شروع' | 'توقف' | 'ادامه' =
    state.status === 'IDLE' ? 'شروع' : state.status === 'RUNNING' ? 'توقف' : 'ادامه';

  let mainButtonDisabled = false;
  let mainButtonDisabledReason: string | null = null;

  if (state.status === 'IDLE' && !state.projectId) {
    mainButtonDisabled = true;
    mainButtonDisabledReason = 'ابتدا یک پروژه انتخاب کنید.';
  } else if (isBreakActive) {
    mainButtonDisabled = true;
    const breakMins = Math.floor(pomodoroRemainingSeconds / 60);
    const breakSecs = pomodoroRemainingSeconds % 60;
    const formattedBreak = `${String(breakMins).padStart(2, '0')}:${String(breakSecs).padStart(2, '0')}`;
    mainButtonDisabledReason = `استراحت تا ${formattedBreak} دیگر`;
  }

  // Register button enablement
  let registerButtonDisabled = false;
  let registerButtonDisabledReason: string | null = null;

  if (state.status === 'RUNNING') {
    registerButtonDisabled = true;
    registerButtonDisabledReason = 'در هنگام اجرای تایمر امکان ثبت وجود ندارد. ابتدا تایمر را متوقف کنید.';
  } else if (workSeconds < MIN_REGISTERABLE_SECONDS) {
    registerButtonDisabled = true;
    registerButtonDisabledReason = 'زمان کار کمتر از حداقل مجاز برای ثبت است.';
  }

  const canStart = !mainButtonDisabled;
  const canRegister = !registerButtonDisabled;
  const projectSelectLocked = state.status === 'RUNNING';

  return {
    status: state.status,
    projectId: state.projectId,
    workMs: currentWorkMs,
    workSeconds,
    pomodoroMode: isBreakActive ? 'BREAK' : 'FOCUS',
    pomodoroRemainingMs,
    pomodoroRemainingSeconds,
    isBreakActive,
    canStart,
    canRegister,
    mainButtonLabel,
    mainButtonDisabled,
    mainButtonDisabledReason,
    registerButtonDisabled,
    registerButtonDisabledReason,
    projectSelectLocked,
  };
}

export function startTimer(state: TimerEngineState, now = Date.now()): TimerEngineState {
  if (state.status === 'RUNNING') return state;
  if (!state.projectId) return state;

  // Cannot start during active break
  if (state.pomodoro.mode === 'BREAK' && state.pomodoro.breakEndsAt && now < state.pomodoro.breakEndsAt) {
    return state;
  }

  let nextPomodoro = { ...state.pomodoro };
  if (state.pomodoro.mode === 'BREAK' && state.pomodoro.breakEndsAt && now >= state.pomodoro.breakEndsAt) {
    // Break elapsed: reset to focus
    nextPomodoro = {
      mode: 'FOCUS',
      focusRemainingMs: FOCUS_MS,
      breakEndsAt: null,
    };
  }

  return {
    ...state,
    status: 'RUNNING',
    lastHeartbeat: now,
    work: {
      accumulatedMs: state.work.accumulatedMs,
      runningSince: now,
      segmentStartedAt: state.work.segmentStartedAt || new Date(now).toISOString(),
    },
    pomodoro: nextPomodoro,
  };
}

export function pauseTimer(state: TimerEngineState, now = Date.now()): TimerEngineState {
  if (state.status !== 'RUNNING') return state;

  const runningSince = state.work.runningSince || now;
  const elapsed = Math.max(0, now - runningSince);

  if (state.pomodoro.mode === 'FOCUS') {
    if (elapsed >= state.pomodoro.focusRemainingMs) {
      // Focus completed exact freeze
      const pomEnd = runningSince + state.pomodoro.focusRemainingMs;
      return {
        ...state,
        status: 'PAUSED',
        lastHeartbeat: now,
        work: {
          accumulatedMs: state.work.accumulatedMs + state.pomodoro.focusRemainingMs,
          runningSince: null,
          segmentStartedAt: state.work.segmentStartedAt,
        },
        pomodoro: {
          mode: 'BREAK',
          focusRemainingMs: 0,
          breakEndsAt: pomEnd + BREAK_MS,
        },
      };
    }

    return {
      ...state,
      status: 'PAUSED',
      lastHeartbeat: now,
      work: {
        accumulatedMs: state.work.accumulatedMs + elapsed,
        runningSince: null,
        segmentStartedAt: state.work.segmentStartedAt,
      },
      pomodoro: {
        ...state.pomodoro,
        focusRemainingMs: Math.max(0, state.pomodoro.focusRemainingMs - elapsed),
      },
    };
  }

  return {
    ...state,
    status: 'PAUSED',
    lastHeartbeat: now,
    work: {
      accumulatedMs: state.work.accumulatedMs,
      runningSince: null,
      segmentStartedAt: state.work.segmentStartedAt,
    },
  };
}

export interface TickResult {
  nextState: TimerEngineState;
  event?: 'FOCUS_ENDED' | 'BREAK_ENDED';
}

export function tickTimer(state: TimerEngineState, now = Date.now()): TickResult {
  // Check if active break just ended
  if (state.pomodoro.mode === 'BREAK') {
    const breakEndsAt = state.pomodoro.breakEndsAt || 0;
    if (now >= breakEndsAt) {
      return {
        nextState: {
          ...state,
          status: 'PAUSED',
          pomodoro: {
            mode: 'FOCUS',
            focusRemainingMs: FOCUS_MS,
            breakEndsAt: null,
          },
        },
        event: 'BREAK_ENDED',
      };
    }
    return { nextState: state };
  }

  // Check if running focus countdown just reached 0
  if (state.status === 'RUNNING' && state.work.runningSince) {
    const elapsed = Math.max(0, now - state.work.runningSince);
    if (state.pomodoro.mode === 'FOCUS' && elapsed >= state.pomodoro.focusRemainingMs) {
      const pomEnd = state.work.runningSince + state.pomodoro.focusRemainingMs;
      const nextState: TimerEngineState = {
        ...state,
        status: 'PAUSED',
        lastHeartbeat: now,
        work: {
          accumulatedMs: state.work.accumulatedMs + state.pomodoro.focusRemainingMs,
          runningSince: null,
          segmentStartedAt: state.work.segmentStartedAt,
        },
        pomodoro: {
          mode: 'BREAK',
          focusRemainingMs: 0,
          breakEndsAt: pomEnd + BREAK_MS,
        },
      };
      return {
        nextState,
        event: 'FOCUS_ENDED',
      };
    }
  }

  return { nextState: state };
}

export function registerContinue(state: TimerEngineState): TimerEngineState {
  return {
    ...state,
    status: 'IDLE',
    projectId: null,
    work: {
      accumulatedMs: 0,
      runningSince: null,
      segmentStartedAt: null,
    },
    pomodoro: { ...state.pomodoro },
  };
}

export function registerFinish(state: TimerEngineState): TimerEngineState {
  return {
    ...state,
    status: 'IDLE',
    projectId: null,
    work: {
      accumulatedMs: 0,
      runningSince: null,
      segmentStartedAt: null,
    },
    pomodoro: {
      mode: 'FOCUS',
      focusRemainingMs: FOCUS_MS,
      breakEndsAt: null,
    },
  };
}

export function changeProject(
  state: TimerEngineState,
  newProjectId: number,
  mode: 'continue' | 'finish' = 'continue'
): TimerEngineState {
  return {
    ...state,
    status: 'PAUSED',
    projectId: newProjectId,
    work: {
      accumulatedMs: 0,
      runningSince: null,
      segmentStartedAt: null,
    },
    pomodoro:
      mode === 'finish'
        ? {
            mode: 'FOCUS',
            focusRemainingMs: FOCUS_MS,
            breakEndsAt: null,
          }
        : { ...state.pomodoro },
  };
}

export function restoreTimerState(
  raw: unknown,
  fallbackProjectId: number | null = null,
  now = Date.now()
): { state: TimerEngineState; wasRecovered: boolean } {
  if (!raw || typeof raw !== 'object') {
    return { state: createInitialTimerState(fallbackProjectId), wasRecovered: false };
  }

  try {
    const data = raw as Partial<TimerEngineState>;
    let wasRecovered = false;

    let status: TimerStatus = data.status === 'RUNNING' || data.status === 'PAUSED' ? data.status : 'IDLE';
    const projectId = typeof data.projectId === 'number' ? data.projectId : fallbackProjectId;

    let accumulatedMs = Number(data.work?.accumulatedMs) || 0;
    const runningSince = typeof data.work?.runningSince === 'number' ? data.work.runningSince : null;
    const segmentStartedAt = typeof data.work?.segmentStartedAt === 'string' ? data.work.segmentStartedAt : null;
    const lastHeartbeat = typeof data.lastHeartbeat === 'number' ? data.lastHeartbeat : null;

    let pomMode: PomodoroMode = data.pomodoro?.mode === 'BREAK' ? 'BREAK' : 'FOCUS';
    let focusRemainingMs =
      typeof data.pomodoro?.focusRemainingMs === 'number' ? data.pomodoro.focusRemainingMs : FOCUS_MS;
    let breakEndsAt = typeof data.pomodoro?.breakEndsAt === 'number' ? data.pomodoro.breakEndsAt : null;

    if (status === 'RUNNING') {
      wasRecovered = true;
      status = 'PAUSED';

      // Count work and pomodoro up to lastHeartbeat only (never to now)
      const hb = lastHeartbeat && runningSince ? Math.max(runningSince, lastHeartbeat) : (runningSince || now);
      const elapsedToHb = runningSince ? Math.max(0, hb - runningSince) : 0;

      if (pomMode === 'FOCUS') {
        if (elapsedToHb >= focusRemainingMs) {
          const pomEnd = (runningSince || hb) + focusRemainingMs;
          accumulatedMs += focusRemainingMs;
          focusRemainingMs = 0;
          const calculatedBreakEnd = pomEnd + BREAK_MS;
          if (now >= calculatedBreakEnd) {
            pomMode = 'FOCUS';
            focusRemainingMs = FOCUS_MS;
            breakEndsAt = null;
          } else {
            pomMode = 'BREAK';
            breakEndsAt = calculatedBreakEnd;
          }
        } else {
          accumulatedMs += elapsedToHb;
          focusRemainingMs = Math.max(0, focusRemainingMs - elapsedToHb);
        }
      }
    } else if (pomMode === 'BREAK' && breakEndsAt) {
      if (now >= breakEndsAt) {
        // Break has elapsed
        pomMode = 'FOCUS';
        focusRemainingMs = FOCUS_MS;
        breakEndsAt = null;
        status = 'PAUSED';
      }
    }

    return {
      state: {
        status,
        projectId,
        work: {
          accumulatedMs,
          runningSince: null,
          segmentStartedAt,
        },
        pomodoro: {
          mode: pomMode,
          focusRemainingMs,
          breakEndsAt,
        },
        lastHeartbeat: now,
      },
      wasRecovered,
    };
  } catch {
    return { state: createInitialTimerState(fallbackProjectId), wasRecovered: false };
  }
}

