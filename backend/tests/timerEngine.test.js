import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Constants matching frontend timer engine
const FOCUS_MS = 25 * 60 * 1000;
const BREAK_MS = 5 * 60 * 1000;
const MIN_REGISTERABLE_SECONDS = 1;

function createInitialState(projectId = null) {
  return {
    status: 'IDLE',
    projectId,
    work: { accumulatedMs: 0, runningSince: null, segmentStartedAt: null },
    pomodoro: { mode: 'FOCUS', focusRemainingMs: FOCUS_MS, breakEndsAt: null },
    lastHeartbeat: null,
  };
}

function startTimer(state, now = Date.now()) {
  if (state.status === 'RUNNING' || !state.projectId) return state;
  if (state.pomodoro.mode === 'BREAK' && state.pomodoro.breakEndsAt && now < state.pomodoro.breakEndsAt) return state;

  let pom = { ...state.pomodoro };
  if (state.pomodoro.mode === 'BREAK' && state.pomodoro.breakEndsAt && now >= state.pomodoro.breakEndsAt) {
    pom = { mode: 'FOCUS', focusRemainingMs: FOCUS_MS, breakEndsAt: null };
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
    pomodoro: pom,
  };
}

function pauseTimer(state, now = Date.now()) {
  if (state.status !== 'RUNNING') return state;
  const runningSince = state.work.runningSince || now;
  const elapsed = Math.max(0, now - runningSince);

  if (state.pomodoro.mode === 'FOCUS') {
    if (elapsed >= state.pomodoro.focusRemainingMs) {
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
        pomodoro: { mode: 'BREAK', focusRemainingMs: 0, breakEndsAt: pomEnd + BREAK_MS },
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
  return state;
}

function tickTimer(state, now = Date.now()) {
  if (state.pomodoro.mode === 'BREAK') {
    if (now >= (state.pomodoro.breakEndsAt || 0)) {
      return {
        nextState: {
          ...state,
          status: 'PAUSED',
          pomodoro: { mode: 'FOCUS', focusRemainingMs: FOCUS_MS, breakEndsAt: null },
        },
        event: 'BREAK_ENDED',
      };
    }
    return { nextState: state };
  }

  if (state.status === 'RUNNING' && state.work.runningSince) {
    const elapsed = Math.max(0, now - state.work.runningSince);
    if (state.pomodoro.mode === 'FOCUS' && elapsed >= state.pomodoro.focusRemainingMs) {
      const pomEnd = state.work.runningSince + state.pomodoro.focusRemainingMs;
      return {
        nextState: {
          ...state,
          status: 'PAUSED',
          lastHeartbeat: now,
          work: {
            accumulatedMs: state.work.accumulatedMs + state.pomodoro.focusRemainingMs,
            runningSince: null,
            segmentStartedAt: state.work.segmentStartedAt,
          },
          pomodoro: { mode: 'BREAK', focusRemainingMs: 0, breakEndsAt: pomEnd + BREAK_MS },
        },
        event: 'FOCUS_ENDED',
      };
    }
  }

  return { nextState: state };
}

function changeProject(state, newProjectId, mode = 'continue') {
  return {
    ...state,
    status: 'PAUSED',
    projectId: newProjectId,
    work: { accumulatedMs: 0, runningSince: null, segmentStartedAt: null },
    pomodoro:
      mode === 'finish'
        ? { mode: 'FOCUS', focusRemainingMs: FOCUS_MS, breakEndsAt: null }
        : { ...state.pomodoro },
  };
}

function restoreTimerState(raw, fallbackProjectId = null, now = Date.now()) {
  let wasRecovered = false;
  let status = raw.status === 'RUNNING' || raw.status === 'PAUSED' ? raw.status : 'IDLE';
  const projectId = raw.projectId || fallbackProjectId;
  let accumulatedMs = raw.work?.accumulatedMs || 0;
  const runningSince = raw.work?.runningSince || null;
  const lastHeartbeat = raw.lastHeartbeat || null;
  let pomMode = raw.pomodoro?.mode === 'BREAK' ? 'BREAK' : 'FOCUS';
  let focusRemainingMs = typeof raw.pomodoro?.focusRemainingMs === 'number' ? raw.pomodoro.focusRemainingMs : FOCUS_MS;
  let breakEndsAt = raw.pomodoro?.breakEndsAt || null;

  if (status === 'RUNNING') {
    wasRecovered = true;
    status = 'PAUSED';
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
  } else if (pomMode === 'BREAK' && breakEndsAt && now >= breakEndsAt) {
    pomMode = 'FOCUS';
    focusRemainingMs = FOCUS_MS;
    breakEndsAt = null;
    status = 'PAUSED';
  }

  return {
    state: {
      status,
      projectId,
      work: { accumulatedMs, runningSince: null, segmentStartedAt: raw.work?.segmentStartedAt || null },
      pomodoro: { mode: pomMode, focusRemainingMs, breakEndsAt },
      lastHeartbeat: now,
    },
    wasRecovered,
  };
}

describe('Timer Engine State Machine Verification Tests', () => {
  test('Initial state: project null means cannot start, register disabled', () => {
    const state = createInitialState(null);
    assert.equal(state.status, 'IDLE');
    assert.equal(state.projectId, null);
    const afterStart = startTimer(state);
    assert.equal(afterStart.status, 'IDLE', 'Must not start without project');
  });

  test('Start and Stop: both timers run and pause at the exact same moment', () => {
    let state = createInitialState(10);
    const t0 = 1000000;
    state = startTimer(state, t0);
    assert.equal(state.status, 'RUNNING');
    assert.equal(state.work.runningSince, t0);

    const t1 = t0 + 12000; // 12 seconds elapsed
    state = pauseTimer(state, t1);
    assert.equal(state.status, 'PAUSED');
    assert.equal(state.work.accumulatedMs, 12000);
    assert.equal(state.pomodoro.focusRemainingMs, FOCUS_MS - 12000);
  });

  test('Pomodoro reaches 0 while running: freezes work timer at exact 25:00 and starts 5 min break', () => {
    let state = createInitialState(10);
    const t0 = 1000000;
    state = startTimer(state, t0);

    const tTick = t0 + FOCUS_MS + 5000; // 5s past 25 min
    const res = tickTimer(state, tTick);
    assert.equal(res.event, 'FOCUS_ENDED');
    state = res.nextState;

    assert.equal(state.status, 'PAUSED');
    assert.equal(state.work.accumulatedMs, FOCUS_MS, 'Must freeze at exact 25:00');
    assert.equal(state.pomodoro.mode, 'BREAK');
    assert.equal(state.pomodoro.breakEndsAt, t0 + FOCUS_MS + BREAK_MS);
  });

  test('When break ends: returns to FOCUS 25:00 and stays PAUSED; work timer kept', () => {
    let state = createInitialState(10);
    const t0 = 1000000;
    state = startTimer(state, t0);
    state = tickTimer(state, t0 + FOCUS_MS).nextState;

    const tBreakOver = t0 + FOCUS_MS + BREAK_MS + 1000;
    const res = tickTimer(state, tBreakOver);
    assert.equal(res.event, 'BREAK_ENDED');
    state = res.nextState;

    assert.equal(state.status, 'PAUSED');
    assert.equal(state.pomodoro.mode, 'FOCUS');
    assert.equal(state.pomodoro.focusRemainingMs, FOCUS_MS);
    assert.equal(state.work.accumulatedMs, FOCUS_MS, 'Work timer retained');
  });

  test('Restore logic on reload while RUNNING: restores as PAUSED up to lastHeartbeat only', () => {
    const t0 = 1000000;
    const tHb = t0 + 15000;
    const tReload = t0 + 120000;

    const raw = {
      status: 'RUNNING',
      projectId: 5,
      work: { accumulatedMs: 0, runningSince: t0, segmentStartedAt: new Date(t0).toISOString() },
      pomodoro: { mode: 'FOCUS', focusRemainingMs: FOCUS_MS, breakEndsAt: null },
      lastHeartbeat: tHb,
    };

    const { state, wasRecovered } = restoreTimerState(raw, null, tReload);
    assert.equal(wasRecovered, true);
    assert.equal(state.status, 'PAUSED');
    assert.equal(state.work.accumulatedMs, 15000, 'Must only count up to lastHeartbeat');
    assert.equal(state.pomodoro.focusRemainingMs, FOCUS_MS - 15000);
  });

  test('changeProject continue: transfers remaining Pomodoro and resets work timer to 0 on new project', () => {
    let state = createInitialState(1);
    state.work.accumulatedMs = 30000;
    state.pomodoro.focusRemainingMs = 15 * 60 * 1000;
    state = changeProject(state, 2, 'continue');
    assert.equal(state.projectId, 2);
    assert.equal(state.work.accumulatedMs, 0);
    assert.equal(state.pomodoro.focusRemainingMs, 15 * 60 * 1000);
    assert.equal(state.status, 'PAUSED');
  });

  test('changeProject finish: resets Pomodoro to 25:00 FOCUS and resets work timer to 0 on new project', () => {
    let state = createInitialState(1);
    state.work.accumulatedMs = 30000;
    state.pomodoro.focusRemainingMs = 15 * 60 * 1000;
    state = changeProject(state, 2, 'finish');
    assert.equal(state.projectId, 2);
    assert.equal(state.work.accumulatedMs, 0);
    assert.equal(state.pomodoro.focusRemainingMs, FOCUS_MS);
    assert.equal(state.pomodoro.mode, 'FOCUS');
    assert.equal(state.status, 'PAUSED');
  });
});

