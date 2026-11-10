import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  isScrumAdminRole,
  getAdministeredScrumIds,
  isScrumAdminOf,
  isScrumMemberOf,
  getVisibleScrumsWhere,
} from "../Modules/Scrum/scrumAccess.js";
import {
  SCRUM_ADMIN_CAN_DECIDE_ATTENDANCE,
  assertCanDecideWorkSession,
  canViewScrumPerformance,
  canViewStudioPerformance,
  canViewAttendanceTotals,
  serializeScrumMemberPerformance,
  serializeStudioPerformance,
  getMemberAttendanceState,
  fetchGroupedAttendanceTotals,
  resolveMemberUserIdParam,
  getMemberWorkScope,
  buildMemberWorkSessionWhere,
} from "../Modules/Scrum/scrumScope.js";
import {
  createScrumValidator,
  addScrumAdminBodyValidator,
  removeScrumAdminQueryValidator,
  updateScrumAdminMembershipBodyValidator,
  scrumIncludeAttendanceQueryValidator,
  updateScrumMemberPerformanceBodyValidator,
} from "../Modules/Scrum/scrumValidator.js";
import { putWorkNoteValidator } from "../Modules/Attendance/attendanceValidator.js";
import { updateUserPerformanceValidator, getUsersValidator } from "../Modules/Users/usersValidator.js";
import {
  saveWorkNoteService,
  getAttendanceImpactService,
} from "../Modules/Attendance/attendanceService.js";
import {
  memberProfileValidator,
  memberCalendarValidator,
  memberDayValidator,
  memberWorkValidator,
} from "../Modules/Member/memberValidator.js";
import {
  getMemberProfileService,
  getMemberCalendarService,
  getMemberDayService,
  getMemberWorkService,
} from "../Modules/Member/memberService.js";

async function runValidatorChain(middlewares, { body = {}, query = {}, params = {} } = {}) {
  const req = { body, query, params };
  let statusCode = 200;
  let jsonPayload = null;
  let nextCalled = false;

  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(payload) {
      jsonPayload = payload;
      return res;
    },
  };

  for (const mw of middlewares) {
    let settled = false;
    nextCalled = false;
    await new Promise((resolve, reject) => {
      const next = (err) => {
        if (err) {
          reject(err);
          return;
        }
        nextCalled = true;
        settled = true;
        resolve();
      };

      const maybePromise = mw(req, res, next);
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise
          .then(() => {
            if (!settled) resolve();
          })
          .catch(reject);
      } else if (!nextCalled && jsonPayload !== null) {
        settled = true;
        resolve();
      }
    });

    if (jsonPayload !== null || !nextCalled) {
      break;
    }
  }

  return { req, statusCode, jsonPayload, passed: nextCalled && jsonPayload === null };
}

function findKeysNamed(node, targetKey, hits = [], path = "$") {
  if (!node || typeof node !== "object") return hits;
  if (Array.isArray(node)) {
    node.forEach((item, i) => findKeysNamed(item, targetKey, hits, `${path}[${i}]`));
    return hits;
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === targetKey) hits.push(`${path}.${k}`);
    findKeysNamed(v, targetKey, hits, `${path}.${k}`);
  }
  return hits;
}

describe("§1 Relationship-Based Scrum Access Helpers", () => {
  test("isScrumAdminRole permits SCRUM_ADMIN and ADMIN only", () => {
    assert.equal(isScrumAdminRole("SCRUM_ADMIN"), true);
    assert.equal(isScrumAdminRole("ADMIN"), true);
    assert.equal(isScrumAdminRole("SUPER_ADMIN"), false);
    assert.equal(isScrumAdminRole("USER"), false);
  });

  test("isScrumAdminOf & isScrumMemberOf distinguish preloaded relations and DB queries", async () => {
    const adminUser = { id: 20, role: "ADMIN" };
    const scrumAdminUser = { id: 30, role: "SCRUM_ADMIN" };
    const plainUser = { id: 40, role: "USER" };
    const superAdmin = { id: 1, role: "SUPER_ADMIN" };

    const scrumPreloaded = {
      id: 5,
      admins: [{ userId: 20 }, { userId: 40 }],
      members: [{ userId: 20 }, { userId: 1 }],
    };

    assert.equal(await isScrumAdminOf(adminUser, scrumPreloaded), true);
    // USER row inside admins array must not grant admin privilege without eligible role
    assert.equal(await isScrumAdminOf(plainUser, scrumPreloaded), false);
    assert.equal(await isScrumAdminOf(scrumAdminUser, scrumPreloaded), false);

    // SUPER_ADMIN is never considered a scrum member even if data exists
    assert.equal(await isScrumMemberOf(adminUser, scrumPreloaded), true);
    assert.equal(await isScrumMemberOf(superAdmin, scrumPreloaded), false);

    const dbStub = {
      scrumAdmin: {
        findUnique: async ({ where }) =>
          where.scrumId_userId.userId === 30 ? { scrumId: 5 } : null,
        findMany: async () => [{ scrumId: 5 }, { scrumId: 8 }],
      },
      scrumMember: {
        findUnique: async ({ where }) =>
          where.scrumId_userId.userId === 40 ? { scrumId: 5 } : null,
      },
    };

    assert.equal(await isScrumAdminOf(scrumAdminUser, 5, dbStub), true);
    assert.equal(await isScrumAdminOf(adminUser, 5, dbStub), false);
    assert.equal(await isScrumMemberOf(plainUser, 5, dbStub), true);
    assert.deepEqual(await getAdministeredScrumIds(adminUser, dbStub), [5, 8]);
    assert.deepEqual(await getAdministeredScrumIds(plainUser, dbStub), []);
    assert.deepEqual(await getAdministeredScrumIds(superAdmin, dbStub), []);
  });

  test("getVisibleScrumsWhere grants union of administered & member scrums for both ADMIN and SCRUM_ADMIN", () => {
    assert.deepEqual(getVisibleScrumsWhere({ id: 1, role: "SUPER_ADMIN" }, { isActive: true }), {
      isActive: true,
    });
    assert.deepEqual(getVisibleScrumsWhere({ id: 10, role: "ADMIN" }, { isActive: true }), {
      isActive: true,
      OR: [{ admins: { some: { userId: 10 } } }, { members: { some: { userId: 10 } } }],
    });
    assert.deepEqual(getVisibleScrumsWhere({ id: 11, role: "SCRUM_ADMIN" }), {
      OR: [{ admins: { some: { userId: 11 } } }, { members: { some: { userId: 11 } } }],
    });
    assert.deepEqual(getVisibleScrumsWhere({ id: 20, role: "USER" }), {
      members: { some: { userId: 20 } },
    });
  });
});

describe("§2 Admin Assignment 'also a member?' Validators", () => {
  test("POST /api/scrums rejects legacy adminIds and missing alsoMember (422)", async () => {
    const legacyRes = await runValidatorChain(createScrumValidator, {
      body: { name: "تست", adminIds: [2] },
    });
    assert.equal(legacyRes.passed, false);
    assert.equal(legacyRes.statusCode, 400);

    const missingAlsoMember = await runValidatorChain(createScrumValidator, {
      body: { name: "تست جدید", admins: [{ userId: 2 }] },
    });
    assert.equal(missingAlsoMember.passed, false);
    assert.equal(missingAlsoMember.statusCode, 422);

    const badAlsoMember = await runValidatorChain(createScrumValidator, {
      body: { name: "تست جدید", admins: [{ userId: 2, alsoMember: "yes" }] },
    });
    assert.equal(badAlsoMember.passed, false);
    assert.equal(badAlsoMember.statusCode, 422);

    const okRes = await runValidatorChain(createScrumValidator, {
      body: { name: "اسکرام نمونه", admins: [{ userId: 2, alsoMember: true }] },
    });
    assert.equal(okRes.passed, true);
  });

  test("POST /:id/admins, DELETE /:id/admins/:userId & PUT /membership validators", async () => {
    const missingFlag = await runValidatorChain(addScrumAdminBodyValidator, {
      body: { userId: 3 },
    });
    assert.equal(missingFlag.passed, false);
    assert.equal(missingFlag.statusCode, 422);

    const validAdd = await runValidatorChain(addScrumAdminBodyValidator, {
      body: { userId: 3, alsoMember: false },
    });
    assert.equal(validAdd.passed, true);

    const badKeep = await runValidatorChain(removeScrumAdminQueryValidator, {
      query: { keepMembership: "maybe" },
    });
    assert.equal(badKeep.passed, false);
    assert.equal(badKeep.statusCode, 400);

    const validOmitKeep = await runValidatorChain(removeScrumAdminQueryValidator, { query: {} });
    assert.equal(validOmitKeep.passed, true);

    const badMembership = await runValidatorChain(updateScrumAdminMembershipBodyValidator, {
      body: { isMember: 1 },
    });
    assert.equal(badMembership.passed, false);
    assert.equal(badMembership.statusCode, 400);

    const okMembership = await runValidatorChain(updateScrumAdminMembershipBodyValidator, {
      body: { isMember: false },
    });
    assert.equal(okMembership.passed, true);
  });
});

describe("§3 & §4 Session Moderation Guards + Attendance Impact", () => {
  test("Nobody (including SUPER_ADMIN) may decide own sessions (403); ADMIN moderates tasks of administered scrums & projects", async () => {
    const sa = { id: 1, role: "SUPER_ADMIN" };
    const adm = { id: 10, role: "ADMIN" };
    const scAdm = { id: 20, role: "SCRUM_ADMIN" };

    // Self-decision blocked for SUPER_ADMIN
    await assert.rejects(
      () =>
        assertCanDecideWorkSession(
          { userId: 1, user: { id: 1, role: "SUPER_ADMIN" }, projectId: 5 },
          sa
        ),
      (err) => err.statusCode === 403
    );

    // ADMIN task moderation checks administered scrum membership
    await assert.doesNotReject(() =>
      assertCanDecideWorkSession(
        {
          userId: 50,
          user: { id: 50, role: "USER" },
          taskId: 8,
          task: { scrumId: 3, scrum: { admins: [{ userId: 10 }] } },
        },
        adm
      )
    );
    await assert.rejects(
      () =>
        assertCanDecideWorkSession(
          {
            userId: 50,
            user: { id: 50, role: "USER" },
            taskId: 9,
            task: { scrumId: 4, scrum: { admins: [] } },
          },
          adm
        ),
      (err) => err.statusCode === 403
    );

    // SCRUM_ADMIN cannot moderate studio project sessions
    await assert.rejects(
      () =>
        assertCanDecideWorkSession(
          { userId: 50, user: { id: 50, role: "USER" }, projectId: 1 },
          scAdm
        ),
      (err) => err.statusCode === 403
    );

    assert.equal(SCRUM_ADMIN_CAN_DECIDE_ATTENDANCE, false);
  });

  test("getAttendanceImpactService returns task/project split and alreadyRejected flag", async () => {
    const dbMock = {
      attendance: {
        findUnique: async ({ where }) =>
          where.id === 99 ? { id: 99, approval: "PENDING" } : null,
      },
      workSession: {
        aggregate: async ({ where }) => {
          if (where.taskId) return { _count: { id: 2 }, _sum: { durationSeconds: 2400 } };
          return { _count: { id: 1 }, _sum: { durationSeconds: 900 } };
        },
      },
    };

    const impact = await getAttendanceImpactService(99, dbMock);
    assert.deepEqual(impact, {
      sessionCount: 3,
      totalSeconds: 3300,
      taskSessionCount: 2,
      projectSessionCount: 1,
      alreadyRejected: false,
    });

    await assert.rejects(
      () => getAttendanceImpactService(404, dbMock),
      (err) => err.statusCode === 404
    );
  });
});

describe("§5 End-of-Work Note Validator & State Rules", () => {
  test("putWorkNoteValidator enforces exact XOR between text and skipped: true", async () => {
    assert.equal((await runValidatorChain(putWorkNoteValidator, { body: {} })).passed, false);
    assert.equal(
      (await runValidatorChain(putWorkNoteValidator, { body: { text: "ok", skipped: true } })).passed,
      false
    );
    assert.equal(
      (await runValidatorChain(putWorkNoteValidator, { body: { skipped: false } })).passed,
      false
    );
    assert.equal(
      (await runValidatorChain(putWorkNoteValidator, { body: { text: "   " } })).passed,
      false
    );
    assert.equal(
      (await runValidatorChain(putWorkNoteValidator, { body: { text: "مانعی نیست" } })).passed,
      true
    );
    assert.equal(
      (await runValidatorChain(putWorkNoteValidator, { body: { skipped: true } })).passed,
      true
    );
  });

  test("saveWorkNoteService handles missing/absent/rejected (409), skipped, idempotency, same-day & midnight-grace", async () => {
    // Now = 2026-11-10 15:00 Tehran (11:30Z)
    const daytimeNow = new Date("2026-11-10T11:30:00.000Z");
    const graceNow = new Date("2026-11-10T20:45:00.000Z"); // 2026-11-11 00:15 Tehran

    // 1. No attendance -> 409
    await assert.rejects(
      () =>
        saveWorkNoteService(7, { text: "test" }, daytimeNow, {
          attendance: { findUnique: async () => null },
        }),
      (err) => err.statusCode === 409
    );

    // 2. ABSENT -> 409; REJECTED -> 409
    await assert.rejects(
      () =>
        saveWorkNoteService(7, { skipped: true }, daytimeNow, {
          attendance: {
            findUnique: async () => ({
              id: 1,
              userId: 7,
              date: new Date("2026-11-10T00:00:00.000Z"),
              status: "ABSENT",
              approval: "APPROVED",
              workNote: null,
              workNotePromptedAt: null,
            }),
          },
        }),
      (err) => err.statusCode === 409
    );

    await assert.rejects(
      () =>
        saveWorkNoteService(7, { text: "hi" }, daytimeNow, {
          attendance: {
            findUnique: async () => ({
              id: 1,
              userId: 7,
              date: new Date("2026-11-10T00:00:00.000Z"),
              status: "PRESENT",
              approval: "REJECTED",
              workNote: null,
              workNotePromptedAt: null,
            }),
          },
        }),
      (err) => err.statusCode === 409
    );

    // 3. Same-day overwrite succeeds; idempotent text preserves old workNoteAt
    const oldTime = new Date("2026-11-10T09:00:00.000Z");
    let updateCalls = 0;
    const sameDayRecord = {
      id: 10,
      userId: 7,
      date: new Date("2026-11-10T00:00:00.000Z"),
      status: "PRESENT",
      approval: "PENDING",
      workNote: "یادداشت اول",
      workNoteAt: oldTime,
      workNotePromptedAt: oldTime,
    };

    const idempRes = await saveWorkNoteService(
      7,
      { text: "یادداشت اول" },
      daytimeNow,
      {
        attendance: {
          findUnique: async () => sameDayRecord,
          update: async () => {
            updateCalls += 1;
            return sameDayRecord;
          },
        },
      }
    );
    assert.equal(updateCalls, 0);
    assert.equal(idempRes.workNotePrompted, true);

    // 4. Midnight grace: empty yesterday note can be written; non-null yesterday note cannot be overwritten (409)
    const yesterdayEmpty = {
      id: 11,
      userId: 7,
      date: new Date("2026-11-10T00:00:00.000Z"), // yesterday relative to 2026-11-11 00:15
      status: "PRESENT",
      approval: "APPROVED",
      workNote: null,
      workNoteAt: null,
      workNotePromptedAt: null,
    };
    let lastUpdateData = null;
    const graceDb = {
      attendance: {
        findUnique: async ({ where }) => {
          const iso = where.userId_date.date.toISOString().slice(0, 10);
          return iso === "2026-11-10" ? yesterdayEmpty : null;
        },
        update: async ({ data }) => {
          lastUpdateData = data;
          return { ...yesterdayEmpty, ...data };
        },
      },
    };
    const savedGrace = await saveWorkNoteService(
      7,
      { text: "نکته نیمه‌شب" },
      graceNow,
      graceDb
    );
    assert.equal(savedGrace.workNote, "نکته نیمه‌شب");
    assert.equal(savedGrace.workNotePrompted, true);
    assert.ok(lastUpdateData.workNotePromptedAt instanceof Date);

    await assert.rejects(
      () =>
        saveWorkNoteService(7, { text: "ویرایش دیرهنگام" }, graceNow, {
          attendance: {
            findUnique: async ({ where }) => {
              const iso = where.userId_date.date.toISOString().slice(0, 10);
              return iso === "2026-11-10"
                ? { ...yesterdayEmpty, workNote: "قبلی", workNotePromptedAt: oldTime }
                : null;
            },
          },
        }),
      (err) => err.statusCode === 409
    );
  });
});

describe("§6 Two-Level Performance Visibility & Key Omission", () => {
  test("Disallowed viewers receive raw objects WITHOUT performance* or studioPerformance keys (Object.hasOwn === false)", () => {
    const memberPerf = {
      performance: "EXCELLENT",
      performanceNote: "عالی",
      performanceUpdatedAt: new Date(),
    };
    const studioPerf = { level: "STRONG", note: "منظم", updatedAt: new Date() };

    const sa = { id: 1, role: "SUPER_ADMIN" };
    const adm = { id: 10, role: "ADMIN" };
    const scAdm = { id: 20, role: "SCRUM_ADMIN" };
    const user5 = { id: 5, role: "USER" };

    // Scrum-level matrix
    assert.equal(canViewScrumPerformance(sa, 5, false), true);
    assert.equal(canViewScrumPerformance(scAdm, 5, true), true);
    assert.equal(canViewScrumPerformance(scAdm, 5, false), false);
    assert.equal(canViewScrumPerformance(adm, 5, true), true);
    assert.equal(canViewScrumPerformance(adm, 5, false), false);
    // Target cannot see own performance even if SCRUM_ADMIN/SUPER_ADMIN
    assert.equal(canViewScrumPerformance(scAdm, 20, true), false);
    assert.equal(canViewScrumPerformance(user5, 5, false), false);

    const hiddenScrum = serializeScrumMemberPerformance(memberPerf, user5, 5, {
      isScrumAdminOfScrum: false,
    });
    assert.equal(Object.hasOwn(hiddenScrum, "performance"), false);
    assert.equal(Object.hasOwn(hiddenScrum, "performanceNote"), false);
    assert.equal(Object.hasOwn(hiddenScrum, "performanceUpdatedAt"), false);

    const visibleScrum = serializeScrumMemberPerformance(memberPerf, scAdm, 5, {
      isScrumAdminOfScrum: true,
    });
    assert.equal(visibleScrum.performance, "EXCELLENT");

    // Studio-level matrix
    assert.equal(canViewStudioPerformance(sa, 5), true);
    assert.equal(canViewStudioPerformance(adm, 5), true);
    assert.equal(canViewStudioPerformance(adm, 10), false); // never self
    assert.equal(canViewStudioPerformance(scAdm, 5), false); // SCRUM_ADMIN never sees studio perf
    assert.equal(canViewStudioPerformance(user5, 6), false);

    const hiddenStudioForScAdm = serializeStudioPerformance(studioPerf, scAdm, 5);
    assert.equal(Object.hasOwn(hiddenStudioForScAdm, "studioPerformance"), false);

    const hiddenStudioForSelf = serializeStudioPerformance(studioPerf, adm, 10);
    assert.equal(Object.hasOwn(hiddenStudioForSelf, "studioPerformance"), false);

    const visibleNullStudioForAdm = serializeStudioPerformance(null, adm, 5);
    assert.equal(Object.hasOwn(visibleNullStudioForAdm, "studioPerformance"), true);
    assert.equal(visibleNullStudioForAdm.studioPerformance, null);
  });

  test("Performance & attendanceTotals validators reject unknown keys and bad values", async () => {
    assert.equal(
      (
        await runValidatorChain(updateScrumMemberPerformanceBodyValidator, {
          body: { level: "STRONG", note: "خوب" },
        })
      ).passed,
      true
    );
    assert.equal(
      (
        await runValidatorChain(updateScrumMemberPerformanceBodyValidator, {
          body: { level: null },
        })
      ).passed,
      true
    );
    assert.equal(
      (
        await runValidatorChain(updateScrumMemberPerformanceBodyValidator, {
          body: { level: "INVALID" },
        })
      ).passed,
      false
    );
    assert.equal(
      (
        await runValidatorChain(updateUserPerformanceValidator, {
          params: { id: "5" },
          body: { level: "EXCELLENT", note: null },
        })
      ).passed,
      true
    );
    assert.equal(
      (
        await runValidatorChain(getUsersValidator, {
          query: { include: "attendanceTotals" },
        })
      ).passed,
      true
    );
    assert.equal(
      (
        await runValidatorChain(scrumIncludeAttendanceQueryValidator, {
          query: { include: "somethingElse" },
        })
      ).passed,
      false
    );
  });
});

describe("§7 Member Detail, Calendar, Day & Work Validators and Service Logic", () => {
  test("Validators enforce userId 'me' or int, calendar max 62 days, and work query parameters", async () => {
    assert.equal(resolveMemberUserIdParam("me", { id: 9 }), 9);
    assert.equal(resolveMemberUserIdParam("12", { id: 9 }), 12);
    assert.throws(() => resolveMemberUserIdParam("abc", { id: 9 }), /400|نامعتبر/);

    assert.equal(
      (await runValidatorChain(memberProfileValidator, { params: { userId: "me" } })).passed,
      true
    );
    assert.equal(
      (await runValidatorChain(memberProfileValidator, { params: { userId: "bad" } })).passed,
      false
    );

    // Calendar: exactly 62 days (inclusive: 2026-09-10 .. 2026-11-10 -> 62 days) passes; 63 days fails
    assert.equal(
      (
        await runValidatorChain(memberCalendarValidator, {
          params: { userId: "5" },
          query: { from: "2026-09-10", to: "2026-11-10" },
        })
      ).passed,
      true
    );
    assert.equal(
      (
        await runValidatorChain(memberCalendarValidator, {
          params: { userId: "5" },
          query: { from: "2026-09-09", to: "2026-11-10" },
        })
      ).passed,
      false
    );
    assert.equal(
      (
        await runValidatorChain(memberCalendarValidator, {
          params: { userId: "5" },
          query: { from: "2026-11-10", to: "2026-11-01" },
        })
      ).passed,
      false
    );

    assert.equal(
      (
        await runValidatorChain(memberDayValidator, {
          params: { userId: "me" },
          query: { date: "2026-11-10" },
        })
      ).passed,
      true
    );
    assert.equal(
      (
        await runValidatorChain(memberWorkValidator, {
          params: { userId: "5" },
          query: { approval: "ALL", scrumId: "1", sprintId: "2", page: "1", limit: "20" },
        })
      ).passed,
      true
    );
  });

  test("Attendance state mapping, canViewAttendanceTotals, workScope & fetchGroupedAttendanceTotals", async () => {
    assert.equal(getMemberAttendanceState(null), "NONE");
    assert.equal(getMemberAttendanceState({ status: "PRESENT", approval: "APPROVED" }), "PRESENT_APPROVED");
    assert.equal(getMemberAttendanceState({ status: "PRESENT", approval: "PENDING" }), "PRESENT_PENDING");
    assert.equal(getMemberAttendanceState({ status: "ABSENT", approval: "APPROVED" }), "ABSENT");
    assert.equal(getMemberAttendanceState({ status: "PRESENT", approval: "REJECTED" }), "REJECTED");

    assert.equal(canViewAttendanceTotals({ role: "USER" }, false), false);
    assert.equal(canViewAttendanceTotals({ role: "SCRUM_ADMIN" }, false), false);
    assert.equal(canViewAttendanceTotals({ role: "SCRUM_ADMIN" }, true), true);
    assert.equal(canViewAttendanceTotals({ role: "ADMIN" }, false), true);
    assert.equal(canViewAttendanceTotals({ role: "SUPER_ADMIN" }, false), true);

    const scScope = getMemberWorkScope({
      viewer: { id: 20, role: "SCRUM_ADMIN" },
      targetUserId: 5,
      administeredScrumIds: [1, 2],
    });
    assert.equal(scScope.canViewProjects, false);
    assert.deepEqual(scScope.scopedTaskScrumIds, [1, 2]);
    assert.deepEqual(
      buildMemberWorkSessionWhere({ targetUserId: 5, workScope: scScope, projectId: 9 }),
      { id: -1 }
    );

    const adminNarrowScope = getMemberWorkScope({
      viewer: { id: 10, role: "ADMIN" },
      targetUserId: 5,
      scrumId: 1,
    });
    assert.equal(adminNarrowScope.canViewProjects, false);
    assert.deepEqual(adminNarrowScope.scopedTaskScrumIds, [1]);

    // Single grouped attendance query
    let groupByCount = 0;
    const totalsMap = await fetchGroupedAttendanceTotals([5, 6], {
      attendance: {
        groupBy: async () => {
          groupByCount += 1;
          return [
            { userId: 5, status: "PRESENT", approval: "APPROVED", _count: { id: 10 } },
            { userId: 5, status: "PRESENT", approval: "PENDING", _count: { id: 2 } },
            { userId: 5, status: "ABSENT", approval: "APPROVED", _count: { id: 1 } },
            { userId: 5, status: "PRESENT", approval: "REJECTED", _count: { id: 3 } },
          ];
        },
      },
    });
    assert.equal(groupByCount, 1);
    assert.deepEqual(totalsMap.get(5), { present: 10, pending: 2, absent: 4 });
    assert.deepEqual(totalsMap.get(6), { present: 0, pending: 0, absent: 0 });
  });

  test("memberService enforces 404/key-omission/projectCount=0 for SCRUM_ADMIN vs ADMIN/self & omits code", async () => {
    const dbMock = {
      user: {
        findUnique: async ({ where }) =>
          where.id === 5
            ? { id: 5, name: "Member Five", role: "USER", isActive: true, code: "SHOULD_NEVER_SELECT" }
            : where.id === 1
            ? { id: 1, name: "SA", role: "SUPER_ADMIN", isActive: true }
            : null,
      },
      scrumAdmin: {
        findMany: async ({ where }) => (where.userId === 20 ? [{ scrumId: 1 }] : []),
      },
      scrumMember: {
        findFirst: async ({ where }) =>
          where.userId === 5 && where.scrumId?.in?.includes(1) ? { scrumId: 1 } : null,
        findUnique: async ({ where }) =>
          where.scrumId_userId.userId === 5 && where.scrumId_userId.scrumId === 1
            ? { scrumId: 1 }
            : null,
        findMany: async ({ where }) => {
          const rows = [
            {
              scrumId: 1,
              label: "بک‌اند",
              performance: "STRONG",
              performanceNote: "پیگیر",
              performanceUpdatedAt: new Date("2026-11-05T10:00:00Z"),
              scrum: { id: 1, name: "Scrum One", color: "ECOSYSTEM" },
            },
            {
              scrumId: 2,
              label: "مهمان",
              performance: "EXCELLENT",
              performanceNote: "عالی",
              performanceUpdatedAt: new Date("2026-11-05T10:00:00Z"),
              scrum: { id: 2, name: "Scrum Two", color: "CLUB" },
            },
          ];
          if (where.scrumId === 1 || where.scrumId?.in?.includes(1)) {
            return rows.filter((r) =>
              where.scrumId?.in ? where.scrumId.in.includes(r.scrumId) : r.scrumId === where.scrumId
            );
          }
          return rows;
        },
      },
      scrum: {
        findFirst: async ({ where }) => (where.id === 1 ? { id: 1 } : null),
      },
      studioPerformance: {
        findUnique: async () => ({
          level: "EXCELLENT",
          note: "منظم",
          updatedAt: new Date("2026-11-06T12:00:00Z"),
        }),
      },
      attendance: {
        groupBy: async () => [
          { userId: 5, status: "PRESENT", approval: "APPROVED", _count: { id: 5 } },
          { userId: 5, status: "PRESENT", approval: "REJECTED", _count: { id: 1 } },
        ],
        findMany: async () => [
          {
            date: new Date("2026-11-09T00:00:00Z"),
            status: "PRESENT",
            approval: "APPROVED",
          },
          {
            date: new Date("2026-11-10T00:00:00Z"),
            status: "PRESENT",
            approval: "REJECTED",
          },
        ],
        findUnique: async () => ({
          status: "PRESENT",
          approval: "APPROVED",
          source: "ADMIN",
          workNote: "تست یادداشت",
          workNoteAt: new Date("2026-11-09T17:00:00Z"),
        }),
      },
      workSession: {
        groupBy: async () => [
          {
            workDate: new Date("2026-11-09T00:00:00Z"),
            taskId: 101,
            projectId: null,
            approval: "APPROVED",
            _sum: { durationSeconds: 1800 },
            _count: { id: 1 },
          },
        ],
        count: async () => 2,
        findMany: async () => [
          {
            id: 500,
            createdAt: new Date("2026-11-09T12:00:00Z"),
            workDate: new Date("2026-11-09T00:00:00Z"),
            durationSeconds: 1800,
            approval: "APPROVED",
            source: "ADMIN",
            projectId: null,
            taskId: 101,
            project: null,
            task: {
              id: 101,
              name: "Task One",
              points: 5,
              scrum: { id: 1, name: "Scrum One", color: "ECOSYSTEM" },
              sprint: { id: 11, number: 2, title: "Sprint 2" },
            },
          },
          {
            id: 501,
            createdAt: new Date("2026-11-09T14:00:00Z"),
            workDate: new Date("2026-11-09T00:00:00Z"),
            durationSeconds: 600,
            approval: "REJECTED",
            source: "ADMIN",
            projectId: null,
            taskId: 101,
            project: null,
            task: {
              id: 101,
              name: "Task One",
              points: 5,
              scrum: { id: 1, name: "Scrum One", color: "ECOSYSTEM" },
              sprint: { id: 11, number: 2, title: "Sprint 2" },
            },
          },
        ],
      },
      task: {
        findMany: async () => [
          {
            id: 101,
            name: "Task One",
            points: 5,
            scrum: { id: 1, name: "Scrum One", color: "ECOSYSTEM" },
            sprint: { id: 11, number: 2, title: "Sprint 2" },
          },
        ],
      },
      project: {
        findMany: async () => [],
      },
    };

    // Unrelated SCRUM_ADMIN (id 21) -> 404
    await assert.rejects(
      () => getMemberProfileService({ id: 21, role: "SCRUM_ADMIN" }, "5", {}, dbMock),
      (err) => err.statusCode === 404
    );

    // Self profile omits both performance & studioPerformance keys completely and includes all memberships
    const selfProfile = await getMemberProfileService({ id: 5, role: "USER" }, "me", {}, dbMock);
    assert.equal(selfProfile.memberships.length, 2);
    assert.equal(Object.hasOwn(selfProfile, "studioPerformance"), false);
    assert.equal(Object.hasOwn(selfProfile.memberships[0], "performance"), false);
    assert.equal(findKeysNamed(selfProfile, "code").length, 0);

    // SCRUM_ADMIN (id 20, admins Scrum 1) sees only Scrum 1 membership + performance, NEVER studioPerformance
    const scProfile = await getMemberProfileService({ id: 20, role: "SCRUM_ADMIN" }, "5", {}, dbMock);
    assert.equal(scProfile.memberships.length, 1);
    assert.equal(scProfile.memberships[0].scrum.id, 1);
    assert.equal(scProfile.memberships[0].performance, "STRONG");
    assert.equal(Object.hasOwn(scProfile, "studioPerformance"), false);

    // ADMIN sees studioPerformance & attendanceTotals
    const admProfile = await getMemberProfileService({ id: 10, role: "ADMIN" }, "5", {}, dbMock);
    assert.equal(admProfile.studioPerformance.level, "EXCELLENT");
    assert.deepEqual(admProfile.attendanceTotals, { present: 5, pending: 0, absent: 1 });

    // Calendar totals count REJECTED as absent; SCRUM_ADMIN gets projectCount: 0
    const scCal = await getMemberCalendarService(
      { id: 20, role: "SCRUM_ADMIN" },
      "5",
      { from: "2026-11-09", to: "2026-11-11" },
      dbMock
    );
    assert.deepEqual(scCal.totals, { present: 1, pending: 0, absent: 1 });
    assert.equal(scCal.days.length, 3);
    assert.equal(scCal.days[0].state, "PRESENT_APPROVED");
    assert.equal(scCal.days[0].taskCount, 1);
    assert.equal(scCal.days[0].projectCount, 0);
    assert.equal(scCal.days[1].state, "REJECTED");
    assert.equal(scCal.days[2].state, "NONE");

    // Day view keeps REJECTED session in `sessions`, excludes REJECTED from `tasks` rollup
    const dayRes = await getMemberDayService(
      { id: 20, role: "SCRUM_ADMIN" },
      "5",
      { date: "2026-11-09" },
      dbMock
    );
    assert.equal(dayRes.sessions.length, 2);
    assert.equal(dayRes.tasks.length, 1);
    assert.equal(dayRes.tasks[0].sessionCount, 1);
    assert.equal(dayRes.tasks[0].totalSeconds, 1800);
    assert.deepEqual(dayRes.projects, []);

    // Work view calculates totals from grouped query and includes sessions pagination meta
    const workRes = await getMemberWorkService(
      { id: 20, role: "SCRUM_ADMIN" },
      "5",
      { from: "2026-11-09", to: "2026-11-10" },
      dbMock
    );
    assert.equal(workRes.totals.approvedSeconds, 1800);
    assert.equal(workRes.sessions.meta.total, 2);
    assert.equal(workRes.tasks[0].task.id, 101);
    assert.equal(findKeysNamed(workRes, "code").length, 0);
  });
});

