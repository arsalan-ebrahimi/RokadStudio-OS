import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  SCRUM_ADMIN_CAN_DECIDE_ATTENDANCE,
  LEADERBOARD_EXCLUDED_ROLES,
  isLeaderboardEligibleMember,
  buildScrumAdminManagedMemberUserWhere,
  scrumAdminManagedTaskRelationFilter,
  buildAttendanceAdminWhere,
  buildAttendanceSessionAggWhere,
  computeAttendanceCanDecide,
  buildWorkSessionReportWhere,
  computeWorkSessionPermissions,
} from "../Modules/Scrum/scrumScope.js";
import { searchUsersValidator } from "../Modules/Users/usersValidator.js";
import { toDateOnly } from "../Utils/date.js";

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

describe("Leaderboard Role Exclusion Tests", () => {
  test("LEADERBOARD_EXCLUDED_ROLES contains SUPER_ADMIN only (ADMIN members participate)", () => {
    assert.equal(LEADERBOARD_EXCLUDED_ROLES.has("SUPER_ADMIN"), true);
    assert.equal(LEADERBOARD_EXCLUDED_ROLES.has("ADMIN"), false);
    assert.equal(LEADERBOARD_EXCLUDED_ROLES.has("SCRUM_ADMIN"), false);
    assert.equal(LEADERBOARD_EXCLUDED_ROLES.has("USER"), false);
  });

  test("isLeaderboardEligibleMember keeps all ScrumMembers except SUPER_ADMIN (includes ADMIN & SCRUM_ADMIN)", () => {
    assert.equal(isLeaderboardEligibleMember({ isScrumMember: true, role: "USER" }), true);
    assert.equal(isLeaderboardEligibleMember({ isScrumMember: true, role: "SCRUM_ADMIN" }), true);
    assert.equal(isLeaderboardEligibleMember({ isScrumMember: true, role: "ADMIN" }), true);
    assert.equal(isLeaderboardEligibleMember({ isScrumMember: true, role: "SUPER_ADMIN" }), false);
    assert.equal(isLeaderboardEligibleMember({ isScrumMember: false, role: "USER" }), false);
    assert.equal(isLeaderboardEligibleMember({ isScrumMember: false, role: "ADMIN" }), false);
    assert.equal(isLeaderboardEligibleMember({ isScrumMember: false, role: "SCRUM_ADMIN" }), false);
    assert.equal(isLeaderboardEligibleMember(null), false);
    assert.equal(isLeaderboardEligibleMember(undefined), false);
  });
});

describe("SCRUM_ADMIN Scoped Attendance Helpers Tests", () => {
  const scrumAdmin = { id: 42, role: "SCRUM_ADMIN" };
  const admin = { id: 10, role: "ADMIN" };
  const superAdmin = { id: 1, role: "SUPER_ADMIN" };

  test("buildAttendanceAdminWhere restricts SCRUM_ADMIN to non-admin members of managed Scrums while keeping global visibility for ADMIN/SUPER_ADMIN", () => {
    const scWhere = buildAttendanceAdminWhere(
      { date: "2026-11-10", approval: "PENDING", userId: "7" },
      scrumAdmin
    );
    assert.deepEqual(scWhere, {
      userId: 7,
      approval: "PENDING",
      date: toDateOnly("2026-11-10"),
      user: buildScrumAdminManagedMemberUserWhere(42),
    });
    assert.deepEqual(scWhere.user.role, { notIn: ["ADMIN", "SUPER_ADMIN"] });

    const admWhere = buildAttendanceAdminWhere(
      { dateFrom: "2026-11-01", dateTo: "2026-11-10", status: "PRESENT", source: "USER" },
      admin
    );
    assert.equal(Object.hasOwn(admWhere, "user"), false);
    assert.deepEqual(admWhere.date, {
      gte: toDateOnly("2026-11-01"),
      lte: toDateOnly("2026-11-10"),
    });
  });

  test("buildAttendanceSessionAggWhere scopes WorkSession duration/counts to managed Scrum tasks for SCRUM_ADMIN only", () => {
    const scAgg = buildAttendanceSessionAggWhere([101, 102], scrumAdmin);
    assert.deepEqual(scAgg, {
      attendanceId: { in: [101, 102] },
      approval: { not: "REJECTED" },
      ...scrumAdminManagedTaskRelationFilter(42),
    });

    const admAgg = buildAttendanceSessionAggWhere([101, 102], admin);
    assert.deepEqual(admAgg, {
      attendanceId: { in: [101, 102] },
      approval: { not: "REJECTED" },
    });
    assert.equal(Object.hasOwn(admAgg, "task"), false);
  });

  test("computeAttendanceCanDecide enforces read-only toggle for SCRUM_ADMIN, self, ADMIN, and SUPER_ADMIN guards", () => {
    assert.equal(SCRUM_ADMIN_CAN_DECIDE_ATTENDANCE, false);

    // Self check (including SUPER_ADMIN)
    assert.equal(computeAttendanceCanDecide({ userId: 42, user: { id: 42, role: "SCRUM_ADMIN" } }, scrumAdmin), false);
    assert.equal(computeAttendanceCanDecide({ userId: 10, user: { id: 10, role: "ADMIN" } }, admin), false);
    assert.equal(computeAttendanceCanDecide({ userId: 1, user: { id: 1, role: "SUPER_ADMIN" } }, superAdmin), false);

    // While SCRUM_ADMIN_CAN_DECIDE_ATTENDANCE is false, SCRUM_ADMIN always has canDecide === false (read-only)
    assert.equal(computeAttendanceCanDecide({ userId: 7, user: { id: 7, role: "USER" } }, scrumAdmin), false);
    assert.equal(computeAttendanceCanDecide({ userId: 43, user: { id: 43, role: "SCRUM_ADMIN" } }, scrumAdmin), false);

    // Flipping toggle restores legacy SCRUM_ADMIN behavior (still blocks self, ADMIN, SUPER_ADMIN)
    assert.equal(computeAttendanceCanDecide({ userId: 7, user: { id: 7, role: "USER" } }, scrumAdmin, true), true);
    assert.equal(computeAttendanceCanDecide({ userId: 43, user: { id: 43, role: "SCRUM_ADMIN" } }, scrumAdmin, true), true);
    assert.equal(computeAttendanceCanDecide({ userId: 10, user: { id: 10, role: "ADMIN" } }, scrumAdmin, true), false);
    assert.equal(computeAttendanceCanDecide({ userId: 1, user: { id: 1, role: "SUPER_ADMIN" } }, scrumAdmin, true), false);

    // ADMIN is unaffected by SCRUM_ADMIN toggle; cannot decide SUPER_ADMIN or self, can decide ADMIN/USER
    assert.equal(computeAttendanceCanDecide({ userId: 1, user: { id: 1, role: "SUPER_ADMIN" } }, admin), false);
    assert.equal(computeAttendanceCanDecide({ userId: 7, user: { id: 7, role: "USER" } }, admin), true);
    assert.equal(computeAttendanceCanDecide({ userId: 11, user: { id: 11, role: "ADMIN" } }, admin), true);

    // SUPER_ADMIN can decide anyone except self
    assert.equal(computeAttendanceCanDecide({ userId: 2, user: { id: 2, role: "SUPER_ADMIN" } }, superAdmin), true);
  });
});

describe("SCRUM_ADMIN & ADMIN Scoped WorkSession Report & Permissions Tests", () => {
  const scrumAdmin = { id: 42, role: "SCRUM_ADMIN" };
  const admin = { id: 10, role: "ADMIN" };
  const superAdmin = { id: 1, role: "SUPER_ADMIN" };

  test("buildWorkSessionReportWhere blocks project/PROJECT queries with { id: -1 } and forces managed Scrum relation for SCRUM_ADMIN", () => {
    assert.deepEqual(buildWorkSessionReportWhere({ projectId: "5" }, scrumAdmin), { id: -1 });
    assert.deepEqual(buildWorkSessionReportWhere({ targetType: "PROJECT" }, scrumAdmin), { id: -1 });

    // Arbitrary taskId is still intersected with scrumAdminManagedTaskRelationFilter via AND
    const withTaskId = buildWorkSessionReportWhere(
      { taskId: "99", date: "2026-11-10" },
      scrumAdmin,
      { defaultExcludeRejected: true }
    );
    assert.deepEqual(withTaskId, {
      AND: [
        { taskId: 99 },
        { approval: { not: "REJECTED" } },
        { workDate: toDateOnly("2026-11-10") },
        scrumAdminManagedTaskRelationFilter(42),
      ],
    });

    // Empty filters still enforce managed Scrum task filter
    const noFilters = buildWorkSessionReportWhere({}, scrumAdmin);
    assert.deepEqual(noFilters, scrumAdminManagedTaskRelationFilter(42));

    // Full ADMIN keeps normal Project access
    const adminProj = buildWorkSessionReportWhere({ projectId: "5", approval: "APPROVED" }, admin);
    assert.deepEqual(adminProj, {
      AND: [{ projectId: 5 }, { approval: "APPROVED" }],
    });
  });

  test("computeWorkSessionPermissions enforces self-moderation ban (incl. SUPER_ADMIN) and ADMIN scrum task scope", () => {
    assert.deepEqual(
      computeWorkSessionPermissions({ userId: 7, user: { id: 7, role: "USER" } }, scrumAdmin),
      { canModerate: true, canDelete: false }
    );
    // Self moderation is always false
    assert.deepEqual(
      computeWorkSessionPermissions({ userId: 42, user: { id: 42, role: "SCRUM_ADMIN" } }, scrumAdmin),
      { canModerate: false, canDelete: true }
    );
    assert.deepEqual(
      computeWorkSessionPermissions({ userId: 1, user: { id: 1, role: "SUPER_ADMIN" } }, superAdmin),
      { canModerate: false, canDelete: true }
    );
    // ADMIN on studio project -> canModerate: true; on managed scrum task -> true; on unmanaged scrum task -> false
    assert.deepEqual(
      computeWorkSessionPermissions({ userId: 7, user: { id: 7, role: "USER" }, projectId: 3 }, admin),
      { canModerate: true, canDelete: true }
    );
    assert.deepEqual(
      computeWorkSessionPermissions(
        { userId: 7, user: { id: 7, role: "USER" }, taskId: 10, task: { scrumId: 5 } },
        admin,
        { administeredScrumIds: new Set([5]) }
      ),
      { canModerate: true, canDelete: true }
    );
    assert.deepEqual(
      computeWorkSessionPermissions(
        { userId: 7, user: { id: 7, role: "USER" }, taskId: 10, task: { scrumId: 9 } },
        admin,
        { administeredScrumIds: new Set([5]) }
      ),
      { canModerate: false, canDelete: true }
    );
    assert.deepEqual(
      computeWorkSessionPermissions({ userId: 1, user: { id: 1, role: "SUPER_ADMIN" } }, admin),
      { canModerate: false, canDelete: true }
    );
    assert.deepEqual(
      computeWorkSessionPermissions({ userId: 7, user: { id: 7, role: "USER" } }, superAdmin),
      { canModerate: true, canDelete: true }
    );
  });
});

describe("Users Search Scope Validator Tests", () => {
  test("accepts omitted scope, scope=all, scope=managed, and rejects invalid scope", async () => {
    const okOmitted = await runValidatorChain(searchUsersValidator, { query: { q: "علی" } });
    const okAll = await runValidatorChain(searchUsersValidator, { query: { scope: "all" } });
    const okManaged = await runValidatorChain(searchUsersValidator, { query: { scope: "managed", q: "سارا" } });
    const badScope = await runValidatorChain(searchUsersValidator, { query: { scope: "team" } });

    assert.equal(okOmitted.passed, true);
    assert.equal(okAll.passed, true);
    assert.equal(okManaged.passed, true);
    assert.equal(badScope.passed, false);
    assert.equal(badScope.statusCode, 400);
  });
});

