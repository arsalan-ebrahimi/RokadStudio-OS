import { randomUUID } from "node:crypto";

const BASE_URL = (process.env.BASE_URL || "http://localhost:5000").replace(/\/+$/, "");

const results = [];

const recordResult = (group, name, passed, detail = "") => {
  results.push({ group, name, passed, detail });
};

const runCheck = async (group, name, fn) => {
  try {
    const detail = await fn();
    recordResult(group, name, true, typeof detail === "string" ? detail : "");
  } catch (err) {
    recordResult(group, name, false, err?.message || String(err));
  }
};

const assert = (cond, message) => {
  if (!cond) {
    throw new Error(message);
  }
};

const hasOwn = (obj, key) =>
  obj !== null && obj !== undefined && Object.prototype.hasOwnProperty.call(obj, key);

const api = async (path, { method = "GET", token = null, body = undefined } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  return { status: res.status, ok: res.ok, json };
};

const login = async (code) => {
  const res = await api("/api/auth/login", { method: "POST", body: { code } });
  assert(
    res.status === 200 && res.json?.success === true && res.json?.data?.token,
    `Login failed for ${code}: status=${res.status}, msg=${res.json?.message}`
  );
  return { token: res.json.data.token, user: res.json.data.user };
};

const findCodeKeys = (node, path = "root", hits = []) => {
  if (node === null || node === undefined || typeof node !== "object") return hits;
  if (Array.isArray(node)) {
    node.forEach((item, idx) => findCodeKeys(item, `${path}[${idx}]`, hits));
    return hits;
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === "code") {
      hits.push(`${path}.${k}`);
    }
    findCodeKeys(v, `${path}.${k}`, hits);
  }
  return hits;
};

const isIsoDateOnly = (val) => typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val);

const getTehranTodayAndWeekday = (now = new Date()) => {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [y, m, d] = ymd.split("-").map(Number);
  const utcMid = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const persianDayOfWeek = (utcMid.getUTCDay() + 1) % 7; // Sat=0 .. Fri=6
  return { todayStr: ymd, persianDayOfWeek };
};

const shiftIsoDate = (isoDate, deltaDays) => {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
};

const uniqueCode = (prefix) => {
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `${prefix}${rand}`.slice(0, 6);
};

const printTable = () => {
  const groupW = 20;
  const nameW = 58;
  const statusW = 8;

  const line = "-".repeat(groupW + nameW + statusW + 38);
  console.log(`\n${line}`);
  console.log(
    `${"GROUP".padEnd(groupW)} | ${"CHECK".padEnd(nameW)} | ${"STATUS".padEnd(statusW)} | DETAIL`
  );
  console.log(line);

  let passedCount = 0;
  for (const r of results) {
    if (r.passed) passedCount += 1;
    const statusStr = r.passed ? "PASS" : "FAIL";
    const truncatedName = r.name.length > nameW ? `${r.name.slice(0, nameW - 3)}...` : r.name;
    console.log(
      `${r.group.padEnd(groupW)} | ${truncatedName.padEnd(nameW)} | ${statusStr.padEnd(statusW)} | ${r.detail}`
    );
  }
  console.log(line);
  console.log(`TOTAL: ${results.length} | PASS: ${passedCount} | FAIL: ${results.length - passedCount}\n`);
  return results.length - passedCount;
};

const main = async () => {
  console.log(`Starting Scrum backend smoke suite against ${BASE_URL} ...`);

  const createdUserIds = [];
  const createdProjectIds = [];
  const createdScrumIds = [];

  let saAuth = null;
  let adminAuth = null;
  let adminScrumMemberAuth = null;
  let adminScrumOnlyAuth = null;
  let scrumAdminAuth = null;
  let scrumAdmin2Auth = null;
  let scrumAdmin3Auth = null;
  let member1Auth = null;
  let member2Auth = null;
  let outsiderAuth = null;

  let tempSuperAdmin = null;
  let tempScrumAdmin = null;
  let tempScrumAdmin2 = null;
  let tempAdmin = null;
  let tempMemberA = null;
  let tempMemberB = null;
  let tempMemberC = null;
  let seededScrum1 = null;
  let seededScrum3 = null;
  let tempScrumId = null;
  let tempScrum2Id = null;

  try {
    // ---------------------------------------------------------
    // 0. Health, Swagger Contract & Auth Setup
    // ---------------------------------------------------------
    await runCheck("Setup", "GET /health is 200 & healthy", async () => {
      const res = await api("/health");
      assert(res.status === 200 && res.json?.success === true, `Expected 200, got ${res.status}`);
      return `db=${res.json?.data?.database}, redis=${res.json?.data?.redis}`;
    });

    await runCheck("Swagger", "GET /api-docs.json matches §1-§7 access, admin-assignment, work-note & member APIs", async () => {
      const res = await api("/api-docs.json");
      assert(res.status === 200 && res.json && typeof res.json === "object", `Status=${res.status}`);
      const doc = res.json;

      const requiredPaths = [
        "/api/users/scrum-admins",
        "/api/users/{id}/performance",
        "/api/projects",
        "/api/projects/{id}",
        "/api/projects/{id}/work-sessions",
        "/api/work-sessions",
        "/api/work-sessions/targets",
        "/api/work-sessions/summary",
        "/api/work-sessions/{id}/decision",
        "/api/attendance/today",
        "/api/attendance/today/work-note",
        "/api/attendance/admin",
        "/api/attendance/admin/{id}/impact",
        "/api/attendance/admin/{id}/decision",
        "/api/scrums",
        "/api/scrums/today-events",
        "/api/scrums/{id}",
        "/api/scrums/{id}/admins",
        "/api/scrums/{id}/admins/{userId}",
        "/api/scrums/{id}/admins/{userId}/membership",
        "/api/scrums/{id}/members",
        "/api/scrums/{id}/members/{userId}/performance",
        "/api/scrums/{id}/tasks",
        "/api/tasks/mine",
        "/api/tasks/{id}",
        "/api/tasks/{id}/members",
        "/api/tasks/{id}/work-sessions",
        "/api/scrums/{id}/sprints",
        "/api/scrums/{id}/kpis",
        "/api/scrums/{id}/events",
        "/api/scrums/{id}/report",
        "/api/scrums/{id}/leaderboard",
        "/api/sprints/{id}",
        "/api/sprints/{id}/status",
        "/api/work-targets/mine",
        "/api/scrum-admin/dashboard",
        "/api/members/{userId}/profile",
        "/api/members/{userId}/calendar",
        "/api/members/{userId}/day",
        "/api/members/{userId}/work",
      ];
      for (const p of requiredPaths) {
        assert(Boolean(doc.paths?.[p]), `Missing swagger path ${p}`);
      }

      assert(Boolean(doc.paths["/api/scrums/{id}/admins"]?.post), "Missing POST /api/scrums/{id}/admins");
      assert(!doc.paths["/api/scrums/{id}/admins"]?.put, "Removed PUT /api/scrums/{id}/admins still in swagger");
      assert(Boolean(doc.paths["/api/scrums/{id}/members"]?.get), "Missing GET /api/scrums/{id}/members");
      assert(!doc.paths["/api/scrums"]?.post?.requestBody?.content?.["application/json"]?.schema?.properties?.adminIds, "Legacy adminIds still on POST /api/scrums schema");

      const removedPaths = [
        "/api/scrums/{id}/projects",
        "/api/scrums/{id}/projects/available",
        "/api/scrums/{id}/projects/link",
        "/api/sprints/{id}/projects",
        "/api/sprint-projects/{id}",
      ];
      for (const p of removedPaths) {
        assert(!doc.paths?.[p], `Legacy path still present in swagger: ${p}`);
      }

      const requiredSchemas = [
        "UserBasicItem",
        "PerformanceLevel",
        "AttendanceTotals",
        "StudioPerformanceItem",
        "ScrumAdminCandidateItem",
        "ScrumAdminDetailItem",
        "AttendanceImpactData",
        "MemberAttendanceState",
        "MemberProfileData",
        "MemberCalendarData",
        "MemberDayData",
        "MemberWorkData",
        "ScrumBrief",
        "ScrumPermissions",
        "ScrumResponse",
        "SprintResponse",
        "ScrumTaskItem",
        "MyScrumTasksResponseData",
        "WorkSessionTaskBrief",
        "WorkTargetSummaryUserRow",
        "WorkTargetSessionRow",
        "WorkTargetSessionsData",
        "WorkTargetSessionsResponse",
        "WorkTargetScrumGroup",
        "KpiRowMember",
        "KpiRowAdmin",
        "ScrumEventItem",
        "TodayScrumEventItem",
        "ScrumReportResponseData",
        "ScrumLeaderboardResponseData",
        "ScrumAdminDashboardResponseData",
      ];
      for (const s of requiredSchemas) {
        assert(Boolean(doc.components?.schemas?.[s]), `Missing swagger schema ${s}`);
      }

      const removedSchemas = [
        "ItemStatus",
        "SprintProjectItem",
        "ScrumLinkedProjectItem",
        "AvailableScrumProjectItem",
      ];
      for (const s of removedSchemas) {
        assert(!doc.components?.schemas?.[s], `Legacy schema still present in swagger: ${s}`);
      }

      assert(!doc.components.schemas.ScrumResponse.properties.ownerId, "ownerId still in ScrumResponse");
      assert(!doc.components.schemas.ProjectDetail.properties.scrumId, "scrumId still in ProjectDetail");
      return `${requiredPaths.length} paths & ${requiredSchemas.length} schemas verified`;
    });

    await runCheck("Setup", "Login all 10 seeded accounts & check /api/auth/me scrum counts", async () => {
      saAuth = await login(process.env.SEED_SUPERADMIN_CODE || "SP0001");
      adminAuth = await login("AD0001");
      adminScrumMemberAuth = await login("AD0002");
      adminScrumOnlyAuth = await login("AD0003");
      scrumAdminAuth = await login("SC1101");
      scrumAdmin2Auth = await login("SC1102");
      scrumAdmin3Auth = await login("SC1103");
      member1Auth = await login("IT1101");
      member2Auth = await login("IT1102");
      outsiderAuth = await login("IT1103");

      assert(adminAuth.user.administeredScrumCount === 0 && adminAuth.user.memberScrumCount === 0, "AD0001 counts expected 0/0");
      assert(adminScrumMemberAuth.user.administeredScrumCount >= 1 && adminScrumMemberAuth.user.memberScrumCount >= 1, "AD0002 counts expected >=1/>=1");
      assert(adminScrumOnlyAuth.user.administeredScrumCount >= 1 && adminScrumOnlyAuth.user.memberScrumCount === 0, "AD0003 counts expected >=1/0");

      const rMe = await api("/api/auth/me", { token: adminScrumMemberAuth.token });
      assert(
        rMe.status === 200 &&
          typeof rMe.json.data.administeredScrumCount === "number" &&
          typeof rMe.json.data.memberScrumCount === "number" &&
          rMe.json.data.administeredScrumCount >= 1,
        `/api/auth/me counts mismatch: ${JSON.stringify(rMe.json?.data)}`
      );
      return "10 seeded accounts logged in + scrum counts verified";
    });

    await runCheck("Setup", "Create & login isolated temp users (incl. temp SUPER_ADMIN, SCRUM_ADMIN, ADMIN, USER)", async () => {
      const specs = [
        { role: "SUPER_ADMIN", name: "Smoke Temp SuperAdmin", prefix: "SU" },
        { role: "SCRUM_ADMIN", name: "Smoke Temp ScrumAdmin1", prefix: "SA" },
        { role: "SCRUM_ADMIN", name: "Smoke Temp ScrumAdmin2", prefix: "SB" },
        { role: "ADMIN", name: "Smoke Temp Admin", prefix: "AD" },
        { role: "USER", name: "Smoke Temp MemberA", prefix: "MA" },
        { role: "USER", name: "Smoke Temp MemberB", prefix: "MB" },
        { role: "USER", name: "Smoke Temp MemberC", prefix: "MC" },
      ];
      const created = [];
      for (const spec of specs) {
        const res = await api("/api/users", {
          method: "POST",
          token: saAuth.token,
          body: { code: uniqueCode(spec.prefix), name: spec.name, role: spec.role },
        });
        assert(res.status === 201 && res.json?.data?.id, `Create ${spec.name} failed (${res.status})`);
        createdUserIds.push(res.json.data.id);
        const logged = await login(res.json.data.code);
        created.push({ ...logged, code: res.json.data.code, id: res.json.data.id });
      }
      [tempSuperAdmin, tempScrumAdmin, tempScrumAdmin2, tempAdmin, tempMemberA, tempMemberB, tempMemberC] = created;
      return `ids=${created.map((u) => u.id).join(",")}`;
    });

    // ---------------------------------------------------------
    // A. §1 Relationship-Based Access, Candidates & Seeded Matrix
    // ---------------------------------------------------------
    await runCheck("UsersScrumAdmin", "GET /api/users/scrum-admins is SA-only, returns SCRUM_ADMIN+ADMIN [{id,name,role}], <=50", async () => {
      const rForb = await api("/api/users/scrum-admins", { token: scrumAdminAuth.token });
      const rForbAdm = await api("/api/users/scrum-admins", { token: adminAuth.token });
      const rForbUser = await api("/api/users/scrum-admins", { token: tempMemberA.token });
      assert(rForb.status === 403 && rForbAdm.status === 403 && rForbUser.status === 403, "Expected 403 for non-SA");

      const rSa = await api("/api/users/scrum-admins", { token: saAuth.token });
      assert(rSa.status === 200 && Array.isArray(rSa.json?.data), `Status=${rSa.status}`);
      assert(rSa.json.data.length >= 6 && rSa.json.data.length <= 50, `Unexpected length ${rSa.json.data.length}`);
      assert(rSa.json.data.some((u) => u.id === scrumAdminAuth.user.id && u.role === "SCRUM_ADMIN"), "Missing SC1101");
      assert(rSa.json.data.some((u) => u.id === adminAuth.user.id && u.role === "ADMIN"), "Missing AD0001");
      assert(rSa.json.data.some((u) => u.id === adminScrumMemberAuth.user.id && u.role === "ADMIN"), "Missing AD0002");
      assert(!rSa.json.data.some((u) => u.id === saAuth.user.id), "SUPER_ADMIN incorrectly included");
      assert(!rSa.json.data.some((u) => u.id === tempMemberA.id), "USER incorrectly included");
      assert(rSa.json.data.every((u) => Object.keys(u).sort().join(",") === "id,name,role"), "Expected exact keys id,name,role");
      assert(findCodeKeys(rSa.json).length === 0, "Leaked code key");
      return `hits=${rSa.json.data.length}`;
    });

    await runCheck("RelationAccess", "Seeded Scrums visibility across AD0001 (0), AD0002, AD0003, SC1101..3 & tempScrumAdmin", async () => {
      // Unrelated ADMIN (AD0001) gets empty lists and 403 on dashboard
      const rAdmList = await api("/api/scrums", { token: adminAuth.token });
      const rAdmEv = await api("/api/scrums/today-events", { token: adminAuth.token });
      const rAdmDash = await api("/api/scrum-admin/dashboard", { token: adminAuth.token });
      assert(rAdmList.status === 200 && rAdmList.json.data.length === 0, "AD0001 expected [] on /scrums");
      assert(rAdmEv.status === 200 && rAdmEv.json.data.length === 0, "AD0001 expected [] on /today-events");
      assert(rAdmDash.status === 403, `AD0001 expected 403 on dashboard, got ${rAdmDash.status}`);

      // Unassigned SCRUM_ADMIN gets empty dashboard 200
      const rUnassignedDash = await api("/api/scrum-admin/dashboard", { token: tempScrumAdmin.token });
      assert(
        rUnassignedDash.status === 200 &&
          rUnassignedDash.json.data.totals.scrums === 0 &&
          rUnassignedDash.json.data.scrums.length === 0 &&
          rUnassignedDash.json.data.todayEvents.length === 0,
        `Unassigned SCRUM_ADMIN expected empty dashboard, got ${rUnassignedDash.status}`
      );

      // SC1101 sees seeded Scrum 1 with Sprint #2 active
      const rSc1 = await api("/api/scrums", { token: scrumAdminAuth.token });
      assert(rSc1.status === 200 && Array.isArray(rSc1.json?.data), `Status=${rSc1.status}`);
      seededScrum1 = rSc1.json.data.find((s) =>
        Array.isArray(s.admins) && s.admins.some((a) => a.id === scrumAdminAuth.user.id)
      );
      assert(seededScrum1, "Seeded Scrum 1 missing for SC1101");
      assert(!hasOwn(seededScrum1, "ownerId"), "Legacy ownerId still present");
      assert(seededScrum1.taskCount >= 3 && seededScrum1.myRole === "ADMIN" && seededScrum1.canEdit === true, "Scrum 1 fields mismatch");
      assert(seededScrum1.activeSprint?.number === 2 && seededScrum1.activeSprint?.status === "ACTIVE", "Expected seeded Scrum 1 activeSprint #2");

      // Direct scrum URL returns 404 for AD0001
      const rAdmDirect = await api(`/api/scrums/${seededScrum1.id}`, { token: adminAuth.token });
      assert(rAdmDirect.status === 404, `Unrelated ADMIN direct scrum expected 404, got ${rAdmDirect.status}`);

      // AD0002 administers & participates in Scrum 1
      const rAd2Dash = await api("/api/scrum-admin/dashboard", { token: adminScrumMemberAuth.token });
      const rAd2Tasks = await api("/api/tasks/mine", { token: adminScrumMemberAuth.token });
      const rAd2Targets = await api("/api/work-targets/mine", { token: adminScrumMemberAuth.token });
      const rAd2Det = await api(`/api/scrums/${seededScrum1.id}`, { token: adminScrumMemberAuth.token });
      assert(rAd2Dash.status === 200 && rAd2Dash.json.data.scrums.some((s) => s.id === seededScrum1.id), "AD0002 dashboard failed");
      assert(rAd2Tasks.status === 200 && rAd2Tasks.json.data.tasks.length >= 1, "AD0002 /api/tasks/mine failed");
      assert(rAd2Targets.status === 200 && rAd2Targets.json.data.scrums.length >= 1, "AD0002 /api/work-targets/mine failed");
      assert(
        rAd2Det.status === 200 &&
          rAd2Det.json.data.admins.some((a) => a.id === adminScrumMemberAuth.user.id && a.role === "ADMIN" && a.isMember === true) &&
          rAd2Det.json.data.members.some((m) => m.id === adminScrumMemberAuth.user.id && m.isAdmin === true),
        "AD0002 detail isMember/isAdmin flags mismatch"
      );

      // AD0003 administers Scrum 3 without membership
      const rAd3List = await api("/api/scrums", { token: adminScrumOnlyAuth.token });
      assert(rAd3List.status === 200 && rAd3List.json.data.length === 1, "AD0003 expected 1 scrum");
      seededScrum3 = rAd3List.json.data[0];
      assert(
        seededScrum3.myRole === "ADMIN" &&
          seededScrum3.admins.some((a) => a.id === adminScrumOnlyAuth.user.id && a.role === "ADMIN" && a.isMember === false),
        "AD0003 expected isMember=false"
      );
      const rAd3Dash = await api("/api/scrum-admin/dashboard", { token: adminScrumOnlyAuth.token });
      const rAd3Lb = await api(`/api/scrums/${seededScrum3.id}/leaderboard?period=ALL`, { token: adminScrumOnlyAuth.token });
      assert(rAd3Dash.status === 200 && rAd3Lb.status === 200, "AD0003 dashboard/leaderboard failed");
      assert(!rAd3Lb.json.data.rows.some((r) => r.user.id === adminScrumOnlyAuth.user.id), "Non-member AD0003 leaked into Scrum 3 leaderboard");

      // Member search excludes ADMIN-role users and leaks no role/code to SCRUM_ADMIN
      const searchArt = await api("/api/users/search?q=Artin", { token: scrumAdminAuth.token });
      const searchAdm = await api("/api/users/search?q=Admin", { token: saAuth.token });
      assert(searchArt.status === 200 && searchArt.json.data.length > 0 && !("role" in searchArt.json.data[0]), "Search Artin failed or leaked role");
      assert(searchAdm.status === 200 && !searchAdm.json.data.some((u) => u.role === "ADMIN"), "/api/users/search leaked ADMIN-role user");
      assert(findCodeKeys(searchArt.json).length === 0 && findCodeKeys(rSc1.json).length === 0, "Leaked code key");
      return `scrum1=${seededScrum1.id}, scrum3=${seededScrum3.id}`;
    });

    // ---------------------------------------------------------
    // B. KPI Secrecy on Seeded Scrum
    // ---------------------------------------------------------
    await runCheck("KPI", "Member GET KPIs omits minExpected key; Assigned SCRUM_ADMIN/ADMIN/SA see minExpected", async () => {
      const mRes = await api(`/api/scrums/${seededScrum1.id}/kpis`, { token: member1Auth.token });
      const oRes = await api(`/api/scrums/${seededScrum1.id}/kpis`, { token: scrumAdminAuth.token });
      const aRes = await api(`/api/scrums/${seededScrum1.id}/kpis`, { token: adminScrumMemberAuth.token });
      const sRes = await api(`/api/scrums/${seededScrum1.id}/kpis`, { token: saAuth.token });
      assert(mRes.status === 200 && mRes.json.data.length > 0 && oRes.status === 200 && aRes.status === 200 && sRes.status === 200, "KPI fetch failed");

      for (const row of mRes.json.data) {
        assert(!hasOwn(row, "minExpected"), "LEAK: minExpected present for member");
      }
      const ownerRow = oRes.json.data[0];
      assert(hasOwn(ownerRow, "minExpected") && hasOwn(aRes.json.data[0], "minExpected"), "Admin missing minExpected");
      assert(!hasOwn(ownerRow, "actualValue"), "Removed actualValue present");
      assert(typeof ownerRow.firstMonthTarget === "string" && typeof ownerRow.target === "string" && typeof ownerRow.finalTarget === "string", "KPI targets must be strings");
      assert(sRes.json.data[0].minExpected === ownerRow.minExpected, "SA minExpected mismatch");
      return `progress=${ownerRow.progressPercent}, status=${ownerRow.status}`;
    });

    // ---------------------------------------------------------
    // C. §2 Admin Assignment ("also a member?"), Membership & Member Sync
    // ---------------------------------------------------------
    await runCheck("AdminAssignment", "POST /api/scrums validates admins[{userId,alsoMember}], rejects legacy adminIds", async () => {
      const rForb1 = await api("/api/scrums", { method: "POST", token: tempMemberA.token, body: { name: "No" } });
      const rForb2 = await api("/api/scrums", { method: "POST", token: tempScrumAdmin.token, body: { name: "No" } });
      const rForb3 = await api("/api/scrums", { method: "POST", token: adminAuth.token, body: { name: "No" } });
      assert(rForb1.status === 403 && rForb2.status === 403 && rForb3.status === 403, "Expected 403 for non-SA");

      const rLegacy = await api("/api/scrums", { method: "POST", token: saAuth.token, body: { name: "Legacy", adminIds: [tempScrumAdmin.id] } });
      const rMissingBool = await api("/api/scrums", { method: "POST", token: saAuth.token, body: { name: "NoBool", admins: [{ userId: tempScrumAdmin.id }] } });
      const rBadRole = await api("/api/scrums", { method: "POST", token: saAuth.token, body: { name: "BadRole", admins: [{ userId: tempMemberA.id, alsoMember: true }] } });
      const rSaAdmin = await api("/api/scrums", { method: "POST", token: saAuth.token, body: { name: "NoSA", admins: [{ userId: saAuth.user.id, alsoMember: false }] } });
      assert(rLegacy.status === 400, `Legacy adminIds expected 400, got ${rLegacy.status}`);
      assert(rMissingBool.status === 422, `Missing alsoMember expected 422, got ${rMissingBool.status}`);
      assert(rBadRole.status === 422 && rSaAdmin.status === 422, `Invalid role expected 422, got ${rBadRole.status}/${rSaAdmin.status}`);

      // Create tempScrum with tempScrumAdmin (alsoMember: false)
      const r1 = await api("/api/scrums", {
        method: "POST",
        token: saAuth.token,
        body: {
          name: "Smoke Test Scrum 1",
          description: "Initial desc",
          color: "COLLEGE",
          admins: [{ userId: tempScrumAdmin.id, alsoMember: false }],
        },
      });
      assert(r1.status === 201 && r1.json?.data?.id, `Create 1 failed: ${r1.status}`);
      tempScrumId = r1.json.data.id;
      createdScrumIds.push(tempScrumId);
      assert(
        r1.json.data.admins.length === 1 &&
          r1.json.data.admins[0].isMember === false &&
          r1.json.data.admins[0].role === "SCRUM_ADMIN" &&
          r1.json.data.members.length === 0,
        `alsoMember:false create mismatch: ${JSON.stringify(r1.json.data)}`
      );

      // Create tempScrum2 with tempScrumAdmin2 (alsoMember: true) + tempAdmin (alsoMember: true)
      const r2 = await api("/api/scrums", {
        method: "POST",
        token: saAuth.token,
        body: {
          name: "Smoke Test Scrum 2",
          color: "CLUB",
          admins: [
            { userId: tempScrumAdmin2.id, alsoMember: true },
            { userId: tempAdmin.id, alsoMember: true },
          ],
        },
      });
      assert(r2.status === 201 && r2.json?.data?.id, `Create 2 failed: ${r2.status}`);
      tempScrum2Id = r2.json.data.id;
      createdScrumIds.push(tempScrum2Id);
      assert(
        r2.json.data.admins.every((a) => a.isMember === true) &&
          r2.json.data.members.length === 2 &&
          r2.json.data.members.every((m) => m.isAdmin === true),
        `alsoMember:true create mismatch: ${JSON.stringify(r2.json.data)}`
      );

      // Auth cache invalidated & updated counts visible immediately on /api/auth/me
      const rMeTempSc = await api("/api/auth/me", { token: tempScrumAdmin.token });
      const rMeTempAdm = await api("/api/auth/me", { token: tempAdmin.token });
      assert(
        rMeTempSc.json.data.administeredScrumCount === 1 &&
          rMeTempSc.json.data.memberScrumCount === 0 &&
          rMeTempAdm.json.data.administeredScrumCount === 1 &&
          rMeTempAdm.json.data.memberScrumCount === 1,
        "Auth /me scrum counts did not invalidate after createScrum"
      );

      // Union visibility on Scrum 2 for tempScrumAdmin
      await api(`/api/scrums/${tempScrum2Id}/members`, {
        method: "PUT",
        token: tempScrumAdmin2.token,
        body: {
          members: [
            { userId: tempScrumAdmin.id, label: "عضو ناظر" },
            { userId: tempMemberA.id, label: "عضو مشترک" },
          ],
        },
      });
      const rList = await api("/api/scrums", { token: tempScrumAdmin.token });
      const s1 = rList.json.data.find((x) => x.id === tempScrumId);
      const s2 = rList.json.data.find((x) => x.id === tempScrum2Id);
      assert(s1?.myRole === "ADMIN" && s1?.canEdit === true && s2?.myRole === "MEMBER" && s2?.canEdit === false, "Union visibility mismatch");
      return `scrum1=${tempScrumId}(alsoMember:false), scrum2=${tempScrum2Id}`;
    });

    await runCheck("AdminAssignment", "POST/DELETE /admins, PUT /membership, preserve admins on sync, 422 ADMIN add", async () => {
      // Legacy PUT /admins removed -> 404
      const rOldPut = await api(`/api/scrums/${tempScrumId}/admins`, { method: "PUT", token: saAuth.token, body: { userIds: [tempScrumAdmin.id] } });
      assert(rOldPut.status === 404, `Legacy PUT /admins expected 404, got ${rOldPut.status}`);

      // Non-SA blocked on admin/archive/delete routes
      const rAddForb = await api(`/api/scrums/${tempScrumId}/admins`, { method: "POST", token: tempScrumAdmin.token, body: { userId: tempScrumAdmin2.id, alsoMember: false } });
      const rArchiveForb = await api(`/api/scrums/${tempScrumId}`, { method: "PATCH", token: tempScrumAdmin.token, body: { isActive: false } });
      const rDelForb = await api(`/api/scrums/${tempScrumId}`, { method: "DELETE", token: tempScrumAdmin.token });
      assert(rAddForb.status === 403 && rArchiveForb.status === 403 && rDelForb.status === 403, "Expected 403s on admin-only routes");

      // Duplicate & missing alsoMember
      const rDup = await api(`/api/scrums/${tempScrumId}/admins`, { method: "POST", token: saAuth.token, body: { userId: tempScrumAdmin.id, alsoMember: false } });
      const rNoBool = await api(`/api/scrums/${tempScrumId}/admins`, { method: "POST", token: saAuth.token, body: { userId: tempScrumAdmin2.id } });
      assert(rDup.status === 409 && rNoBool.status === 422, `Expected 409/422, got ${rDup.status}/${rNoBool.status}`);

      // Add tempScrumAdmin2 with alsoMember: true -> toggle membership -> DELETE requires keepMembership for SCRUM_ADMIN member
      const rAdd2 = await api(`/api/scrums/${tempScrumId}/admins`, { method: "POST", token: saAuth.token, body: { userId: tempScrumAdmin2.id, alsoMember: true } });
      assert(rAdd2.status === 201 && rAdd2.json.data.isMember === true, "POST /admins with alsoMember:true failed");

      // Create disposable task to confirm membership removal cleans TaskMember
      const rTmpTask = await api(`/api/scrums/${tempScrumId}/tasks`, {
        method: "POST",
        token: tempScrumAdmin.token,
        body: { name: "Cleanup Check Task", memberIds: [tempScrumAdmin2.id] },
      });
      assert(rTmpTask.status === 201, "Create cleanup check task failed");
      const tmpTaskId = rTmpTask.json.data.id;

      // Toggle off -> TaskMember cleaned
      const rMemOff = await api(`/api/scrums/${tempScrumId}/admins/${tempScrumAdmin2.id}/membership`, {
        method: "PUT",
        token: saAuth.token,
        body: { isMember: false },
      });
      const rTaskAfterOff = await api(`/api/tasks/${tmpTaskId}`, { token: tempScrumAdmin.token });
      assert(rMemOff.status === 200 && rMemOff.json.data.isMember === false, "PUT /membership false failed");
      assert(rTaskAfterOff.status === 200 && rTaskAfterOff.json.data.members.length === 0, "Removing membership via PUT /membership did not clean TaskMember");
      await api(`/api/tasks/${tmpTaskId}`, { method: "DELETE", token: tempScrumAdmin.token });

      // Toggle back on -> DELETE without keepMembership MUST return 422
      const rMemOn = await api(`/api/scrums/${tempScrumId}/admins/${tempScrumAdmin2.id}/membership`, {
        method: "PUT",
        token: saAuth.token,
        body: { isMember: true },
      });
      assert(rMemOn.status === 200 && rMemOn.json.data.isMember === true, "PUT /membership true failed");

      const rDelMissingKeep = await api(`/api/scrums/${tempScrumId}/admins/${tempScrumAdmin2.id}`, {
        method: "DELETE",
        token: saAuth.token,
      });
      assert(rDelMissingKeep.status === 422, `DELETE SCRUM_ADMIN member without keepMembership expected 422, got ${rDelMissingKeep.status}`);

      // Sync members MUST preserve existing admin-member tempScrumAdmin2 AND reject adding ADMIN-role user
      const rRejectAdminMem = await api(`/api/scrums/${tempScrumId}/members`, {
        method: "PUT",
        token: tempScrumAdmin.token,
        body: { members: [{ userId: tempAdmin.id, label: "ادمین" }] },
      });
      assert(rRejectAdminMem.status === 422, `Adding ADMIN via /members expected 422, got ${rRejectAdminMem.status}`);

      const rSyncPreserve = await api(`/api/scrums/${tempScrumId}/members`, {
        method: "PUT",
        token: tempScrumAdmin.token,
        body: {
          members: [
            { userId: tempMemberA.id, label: "عضو الف" },
            { userId: tempMemberB.id, label: "عضو ب" },
            { userId: tempMemberC.id, label: "عضو ج" },
          ],
        },
      });
      assert(
        rSyncPreserve.status === 200 &&
          rSyncPreserve.json.data.some((m) => m.id === tempScrumAdmin2.id && m.isAdmin === true),
        "PUT /members dropped existing ScrumAdmin member!"
      );

      // Remove tempScrumAdmin2 from tempScrumId with keepMembership=false
      const rDel2 = await api(`/api/scrums/${tempScrumId}/admins/${tempScrumAdmin2.id}?keepMembership=false`, {
        method: "DELETE",
        token: saAuth.token,
      });
      assert(rDel2.status === 200, `DELETE /admins?keepMembership=false failed: ${rDel2.status}`);

      // On tempScrum2Id, tempScrumAdmin was preserved as non-admin member when synced earlier, and removing ADMIN-role tempAdmin ALWAYS removes membership even if keepMembership=true
      const rDelAdminRole = await api(`/api/scrums/${tempScrum2Id}/admins/${tempAdmin.id}?keepMembership=true`, {
        method: "DELETE",
        token: saAuth.token,
      });
      const rDet2After = await api(`/api/scrums/${tempScrum2Id}`, { token: saAuth.token });
      assert(
        rDelAdminRole.status === 200 &&
          !rDet2After.json.data.admins.some((a) => a.id === tempAdmin.id) &&
          !rDet2After.json.data.members.some((m) => m.id === tempAdmin.id),
        "Deleting ADMIN-role scrum admin did not strip ScrumMember too!"
      );

      // Managed scope search for SCRUM_ADMIN returns only A, B, C (no role/code)
      const rManagedSearch = await api("/api/users/search?scope=managed", { token: tempScrumAdmin.token });
      const managedIds = new Set((rManagedSearch.json?.data || []).map((u) => u.id));
      assert(
        rManagedSearch.status === 200 &&
          managedIds.size === 3 &&
          managedIds.has(tempMemberA.id) &&
          managedIds.has(tempMemberB.id) &&
          managedIds.has(tempMemberC.id) &&
          rManagedSearch.json.data.every((u) => !hasOwn(u, "role") && !hasOwn(u, "code")),
        `GET /api/users/search?scope=managed mismatch: ${JSON.stringify(rManagedSearch.json)}`
      );

      return "alsoMember lifecycle, admin preservation, 422 guards & scope=managed verified";
    });

    await runCheck("IDOR & RBAC", "Outsider & unrelated ADMIN get 404; member gets 403 across scrum routes", async () => {
      const checks404 = [
        ["GET", `/api/scrums/${tempScrumId}`, outsiderAuth.token],
        ["GET", `/api/scrums/${tempScrumId}`, adminAuth.token],
        ["GET", `/api/scrums/${tempScrumId}/members`, outsiderAuth.token],
        ["PATCH", `/api/scrums/${tempScrumId}`, outsiderAuth.token, { name: "x" }],
        ["DELETE", `/api/scrums/${tempScrumId}`, outsiderAuth.token],
        ["POST", `/api/scrums/${tempScrumId}/admins`, outsiderAuth.token, { userId: tempScrumAdmin2.id, alsoMember: false }],
        ["PUT", `/api/scrums/${tempScrumId}/members`, outsiderAuth.token, { members: [] }],
        ["GET", `/api/scrums/${tempScrumId}/tasks`, outsiderAuth.token],
        ["POST", `/api/scrums/${tempScrumId}/tasks`, outsiderAuth.token, { name: "x" }],
        ["GET", `/api/scrums/${tempScrumId}/sprints`, outsiderAuth.token],
        ["GET", `/api/scrums/${tempScrumId}/kpis`, outsiderAuth.token],
        ["GET", `/api/scrums/${tempScrumId}/events`, outsiderAuth.token],
        ["GET", `/api/scrums/${tempScrumId}/report`, outsiderAuth.token],
        ["GET", `/api/scrums/${tempScrumId}/leaderboard`, outsiderAuth.token],
        ["GET", `/api/scrums/${tempScrumId}`, scrumAdminAuth.token],
      ];
      for (const [m, p, tok, body] of checks404) {
        const res = await api(p, { method: m, token: tok, body });
        assert(res.status === 404, `${m} ${p} expected 404, got ${res.status}`);
      }

      const checks403 = [
        ["PATCH", `/api/scrums/${tempScrumId}`, tempMemberA.token, { name: "Hack" }],
        ["PUT", `/api/scrums/${tempScrumId}/members`, tempMemberA.token, { members: [] }],
        ["POST", `/api/scrums/${tempScrumId}/tasks`, tempMemberA.token, { name: "Nope" }],
        ["POST", `/api/scrums/${tempScrumId}/sprints`, tempMemberA.token, {}],
        ["PUT", `/api/scrums/${tempScrumId}/kpis`, tempMemberA.token, { rows: [] }],
        ["PUT", `/api/scrums/${tempScrumId}/events`, tempMemberA.token, { rows: [] }],
        ["PATCH", `/api/scrums/${tempScrum2Id}`, tempScrumAdmin.token, { name: "Not Admin Here" }],
      ];
      for (const [m, p, tok, body] of checks403) {
        const res = await api(p, { method: m, token: tok, body });
        assert(res.status === 403, `${m} ${p} expected 403, got ${res.status}`);
      }
      return `${checks404.length}x404 & ${checks403.length}x403 verified`;
    });

    // ---------------------------------------------------------
    // D. KPI & Events Batch Update + Today Events
    // ---------------------------------------------------------
    await runCheck("KPI & Events", "Batch KPIs, batch Events & Tehran /today-events archive guard", async () => {
      const rKpi = await api(`/api/scrums/${tempScrumId}/kpis`, {
        method: "PUT",
        token: tempScrumAdmin.token,
        body: {
          rows: [
            { indicator: "Below Min", firstMonthTarget: "۴۰ درصد", target: "۸۰ درصد", finalTarget: "۱۰۰ درصد", minExpected: 50, progressPercent: 30, status: "BELOW_MIN" },
            { indicator: "On Target", firstMonthTarget: "۶۰", target: "۹۰", finalTarget: "۱۰۰", minExpected: 50, progressPercent: 100, status: "ON_TARGET" },
          ],
        },
      });
      assert(rKpi.status === 200 && rKpi.json.data.length === 2, "KPI batch update failed");
      assert(rKpi.json.data[0].finalTarget === "۱۰۰ درصد" && rKpi.json.data[0].status === "BELOW_MIN" && rKpi.json.data[1].progressPercent === 100, "KPI manual fields/targets mismatch");

      const { todayStr, persianDayOfWeek } = getTehranTodayAndWeekday();
      const otherDay = (persianDayOfWeek + 1) % 7;
      const rEv = await api(`/api/scrums/${tempScrumId}/events`, {
        method: "PUT",
        token: tempScrumAdmin.token,
        body: {
          rows: [
            { name: "Today Weekly", scheduleType: "WEEKLY", dayOfWeek: persianDayOfWeek, startTime: "09:00", durationMinutes: 15 },
            { name: "Today Once", scheduleType: "ONCE", date: todayStr, startTime: "11:00", durationMinutes: 30 },
            { name: "Tomorrow Weekly", scheduleType: "WEEKLY", dayOfWeek: otherDay, startTime: "10:00", durationMinutes: 20 },
          ],
        },
      });
      assert(rEv.status === 200 && rEv.json.data.length === 3 && isIsoDateOnly(rEv.json.data[1].date), "Events failed");

      const rToday = await api("/api/scrums/today-events", { token: tempMemberA.token });
      assert(rToday.status === 200 && rToday.json.data.filter((e) => e.scrumId === tempScrumId).length === 2, "Expected 2 today events");
      return `today=${todayStr}, kpis=2, events=3`;
    });

    // ---------------------------------------------------------
    // E. Decoupled Standalone Studio Projects & Project Work-Log Endpoint
    // ---------------------------------------------------------
    let standaloneProjId = null;

    await runCheck("StandaloneProject", "Projects decoupled; GET /projects/mine & read-only /projects/:id/work-sessions for members", async () => {
      const rCreate = await api("/api/projects", {
        method: "POST",
        token: saAuth.token,
        body: {
          name: "Smoke Standalone Studio Project",
          description: "Pure Studio Project (decoupled from Scrum)",
          memberIds: [tempMemberA.id, tempMemberC.id, tempAdmin.id, tempScrumAdmin.id],
        },
      });
      assert(rCreate.status === 201 && rCreate.json?.data?.id, `Create project failed: ${rCreate.status}`);
      assert(!hasOwn(rCreate.json.data, "scrumId") && !hasOwn(rCreate.json.data, "scrum"), "Project response still contains scrumId/scrum");
      standaloneProjId = rCreate.json.data.id;
      createdProjectIds.push(standaloneProjId);

      // Assigned member gets 200 read-only & sees project in /mine
      const rMine = await api("/api/projects/mine?includeInactive=true", { token: tempMemberA.token });
      const rMineAdm = await api("/api/projects/mine", { token: tempAdmin.token });
      const rMineSc = await api("/api/projects/mine", { token: tempScrumAdmin.token });
      assert(rMine.status === 200 && rMine.json.data.some((p) => p.id === standaloneProjId), "Member /projects/mine missing project");
      assert(rMineAdm.status === 200 && rMineAdm.json.data.some((p) => p.id === standaloneProjId), "ADMIN personal /projects/mine missing project");
      assert(rMineSc.status === 200 && rMineSc.json.data.some((p) => p.id === standaloneProjId), "SCRUM_ADMIN personal /projects/mine missing project");

      // Assigned non-admin SCRUM_ADMIN gets read-only (canModerate: false); unassigned gets 404
      const rMemView = await api(`/api/projects/${standaloneProjId}/work-sessions`, { token: tempMemberA.token });
      assert(
        rMemView.status === 200 &&
          rMemView.json.data.permissions.canViewAllUsers === true &&
          rMemView.json.data.permissions.canModerate === false &&
          rMemView.json.data.permissions.canDelete === false,
        `Assigned member expected 200 read-only, got ${rMemView.status}`
      );

      const rAdm = await api(`/api/projects/${standaloneProjId}/work-sessions`, { token: adminAuth.token });
      assert(rAdm.status === 200 && rAdm.json.data.target.kind === "PROJECT" && rAdm.json.data.permissions.canModerate === true, "ADMIN project view failed");
      return `projectId=${standaloneProjId}`;
    });

    // ---------------------------------------------------------
    // F. Simplified Sprints
    // ---------------------------------------------------------
    let sprint1 = null;
    let sprint2 = null;
    let sprint3 = null;

    await runCheck("SimpleSprints", "Concurrent create, progressPercent validation & bidirectional phase transitions", async () => {
      const rBadProg = await api(`/api/scrums/${tempScrumId}/sprints`, {
        method: "POST",
        token: tempScrumAdmin.token,
        body: { title: "Bad Progress", progressPercent: 101 },
      });
      assert(rBadProg.status === 400, `progressPercent=101 expected 400, got ${rBadProg.status}`);

      const responses = await Promise.all([
        api(`/api/scrums/${tempScrumId}/sprints`, { method: "POST", token: tempScrumAdmin.token, body: { progressPercent: 10 } }),
        api(`/api/scrums/${tempScrumId}/sprints`, { method: "POST", token: tempScrumAdmin.token, body: {} }),
        api(`/api/scrums/${tempScrumId}/sprints`, { method: "POST", token: tempScrumAdmin.token, body: {} }),
      ]);
      for (const r of responses) {
        assert(r.status === 201 && r.json?.data?.id, `Concurrent sprint create failed: ${r.status}`);
      }

      const sprintsList = await api(`/api/scrums/${tempScrumId}/sprints`, { token: tempScrumAdmin.token });
      [sprint1, sprint2, sprint3] = sprintsList.json.data;

      const [a1, a2] = await Promise.all([
        api(`/api/sprints/${sprint1.id}/status`, { method: "PATCH", token: tempScrumAdmin.token, body: { status: "ACTIVE" } }),
        api(`/api/sprints/${sprint2.id}/status`, { method: "PATCH", token: tempScrumAdmin.token, body: { status: "ACTIVE" } }),
      ]);
      const statuses = [a1.status, a2.status].sort((x, y) => x - y);
      assert(statuses[0] === 200 && statuses[1] === 409, `Expected [200, 409], got [${statuses.join(",")}]`);
      sprint1 = a1.status === 200 ? a1.json.data : a2.json.data;

      await api(`/api/sprints/${sprint1.id}/status`, { method: "PATCH", token: tempScrumAdmin.token, body: { status: "COMPLETED" } });
      await api(`/api/sprints/${sprint1.id}/status`, { method: "PATCH", token: tempScrumAdmin.token, body: { status: "ACTIVE" } });
      const tBackPlanned = await api(`/api/sprints/${sprint1.id}/status`, { method: "PATCH", token: tempScrumAdmin.token, body: { status: "PLANNED" } });
      assert(tBackPlanned.status === 200 && tBackPlanned.json.data.status === "PLANNED", "ACTIVE -> PLANNED revert failed");

      const { todayStr } = getTehranTodayAndWeekday();
      const rPatch = await api(`/api/sprints/${sprint1.id}`, {
        method: "PATCH",
        token: tempScrumAdmin.token,
        body: { startDate: todayStr, endDate: todayStr, progressPercent: 60 },
      });
      assert(rPatch.status === 200 && rPatch.json.data.progressPercent === 60 && rPatch.json.data.startDate === todayStr, "Sprint patch failed");
      sprint1 = rPatch.json.data;

      await api(`/api/sprints/${sprint3.id}`, { method: "DELETE", token: tempScrumAdmin.token });
      return `sprint1=${sprint1.id}, progress=60%`;
    });

    // ---------------------------------------------------------
    // G. Scrum Tasks (Task + TaskMember) & Work Targets without Active Sprint
    // ---------------------------------------------------------
    let taskA = null;
    let taskB = null;
    let taskInactive = null;

    await runCheck("ScrumTasks", "Task CRUD with Sprint link, member task scoping, 422 checks & WorkTargets", async () => {
      const rBadMem = await api(`/api/scrums/${tempScrumId}/tasks`, {
        method: "POST",
        token: tempScrumAdmin.token,
        body: { name: "Invalid Assignee Task", points: 3, memberIds: [outsiderAuth.user.id] },
      });
      assert(rBadMem.status === 422, `Outsider member expected 422, got ${rBadMem.status}`);

      const rSeededSprints = await api(`/api/scrums/${seededScrum1.id}/sprints`, { token: saAuth.token });
      const otherScrumSprintId = rSeededSprints.json?.data?.[0]?.id;
      const rBadSprint = await api(`/api/scrums/${tempScrumId}/tasks`, {
        method: "POST",
        token: tempScrumAdmin.token,
        body: { name: "Wrong Sprint Task", points: 2, sprintId: otherScrumSprintId },
      });
      assert(rBadSprint.status === 422, `Cross-scrum sprintId expected 422, got ${rBadSprint.status}`);

      const rA = await api(`/api/scrums/${tempScrumId}/tasks`, {
        method: "POST",
        token: tempScrumAdmin.token,
        body: { name: "Task Alpha", points: 5, isActive: true, sprintId: sprint1.id, memberIds: [tempMemberA.id, tempMemberB.id] },
      });
      const rB = await api(`/api/scrums/${tempScrumId}/tasks`, {
        method: "POST",
        token: tempScrumAdmin.token,
        body: { name: "Task Beta", points: 8, isActive: true, memberIds: [tempMemberB.id] },
      });
      const rInact = await api(`/api/scrums/${tempScrumId}/tasks`, {
        method: "POST",
        token: tempScrumAdmin.token,
        body: { name: "Task Inactive", points: 3, isActive: false, memberIds: [tempMemberA.id] },
      });
      assert(rA.status === 201 && rB.status === 201 && rInact.status === 201, "Create tasks failed");
      taskA = rA.json.data;
      taskB = rB.json.data;
      taskInactive = rInact.json.data;

      const rTasksMemA = await api(`/api/scrums/${tempScrumId}/tasks`, { token: tempMemberA.token });
      const rTasksSprint1 = await api(`/api/scrums/${tempScrumId}/tasks?sprintId=${sprint1.id}`, { token: tempScrumAdmin.token });
      assert(rTasksMemA.status === 200 && rTasksMemA.json.data.length === 2 && !rTasksMemA.json.data.some((t) => t.id === taskB.id), "Member task scoping failed");
      assert(rTasksSprint1.status === 200 && rTasksSprint1.json.data.length === 1 && rTasksSprint1.json.data[0].id === taskA.id, "sprintId filter failed");

      const wtA = await api("/api/work-targets/mine", { token: tempMemberA.token });
      const grp = wtA.json.data.scrums.find((g) => g.scrum.id === tempScrumId);
      assert(grp && grp.sprint === null && grp.tasks.some((t) => t.id === taskA.id) && !grp.tasks.some((t) => t.id === taskInactive.id), "/work-targets/mine mismatch");
      return `tasks=${taskA.id},${taskB.id},${taskInactive.id}`;
    });

    // ---------------------------------------------------------
    // H. §3-§5 Attendance, Read-Only SCRUM_ADMIN, Self-Decision 403, Impact & Work Note
    // ---------------------------------------------------------
    let wsA1Id = null;
    let wsA2Id = null;
    let wsAProjId = null;
    let wsBApprovedId = null;
    let wsBPendingId = null;
    let wsBRejectedId = null;
    let attAId = null;
    let attBId = null;
    let attCId = null;
    let attTempAdminId = null;
    let attScAdminId = null;
    let attTempSuperId = null;

    await runCheck("WorkSessionTask", "Personal /app flow (incl. ADMIN/SCRUM_ADMIN/SA) & Task logging", async () => {
      const attA = await api("/api/attendance/today", { method: "POST", token: tempMemberA.token, body: { status: "PRESENT" } });
      const attB = await api("/api/attendance/today", { method: "POST", token: tempMemberB.token, body: { status: "PRESENT" } });
      const attC = await api("/api/attendance/today", { method: "POST", token: tempMemberC.token, body: { status: "PRESENT" } });
      const attTempAdm = await api("/api/attendance/today", { method: "POST", token: tempAdmin.token, body: { status: "PRESENT" } });
      const attScAdm = await api("/api/attendance/today", { method: "POST", token: tempScrumAdmin.token, body: { status: "PRESENT" } });
      const attTempSup = await api("/api/attendance/today", { method: "POST", token: tempSuperAdmin.token, body: { status: "PRESENT" } });

      assert(
        [attA, attB, attC, attTempAdm, attScAdm, attTempSup].every((r) => r.status === 200 && r.json?.data?.id),
        "Attendance creation failed"
      );
      assert(!hasOwn(attA.json.data, "workNotePromptedAt") && attA.json.data.workNote === null && attA.json.data.workNotePrompted === false, "POST /attendance/today workNote fields mismatch");
      attAId = attA.json.data.id;
      attBId = attB.json.data.id;
      attCId = attC.json.data.id;
      attTempAdminId = attTempAdm.json.data.id;
      attScAdminId = attScAdm.json.data.id;
      attTempSuperId = attTempSup.json.data.id;

      await api(`/api/attendance/admin/${attAId}/decision`, { method: "PATCH", token: adminAuth.token, body: { decision: "APPROVED" } });
      await api(`/api/attendance/admin/${attBId}/decision`, { method: "PATCH", token: adminAuth.token, body: { decision: "APPROVED" } });

      const nowIso = new Date().toISOString();

      // XOR & guard checks
      const rBoth = await api("/api/work-sessions", { method: "POST", token: tempMemberA.token, body: { projectId: standaloneProjId, taskId: taskA.id, durationSeconds: 100, startedAt: nowIso, clientRequestId: randomUUID() } });
      const rNeither = await api("/api/work-sessions", { method: "POST", token: tempMemberA.token, body: { durationSeconds: 100, startedAt: nowIso, clientRequestId: randomUUID() } });
      const rInactive = await api("/api/work-sessions", { method: "POST", token: tempMemberA.token, body: { taskId: taskInactive.id, durationSeconds: 100, startedAt: nowIso, clientRequestId: randomUUID() } });
      const rUnassigned = await api("/api/work-sessions", { method: "POST", token: tempMemberC.token, body: { taskId: taskA.id, durationSeconds: 100, startedAt: nowIso, clientRequestId: randomUUID() } });
      assert(rBoth.status === 422 && rNeither.status === 422 && rInactive.status === 400 && rUnassigned.status === 403, "WorkSession guard mismatch");

      const wsA1 = await api("/api/work-sessions", { method: "POST", token: tempMemberA.token, body: { taskId: taskA.id, durationSeconds: 600, startedAt: nowIso, clientRequestId: randomUUID() } });
      const wsA2 = await api("/api/work-sessions", { method: "POST", token: tempMemberA.token, body: { taskId: taskA.id, durationSeconds: 400, startedAt: nowIso, clientRequestId: randomUUID() } });
      const wsAProj = await api("/api/work-sessions", { method: "POST", token: tempMemberA.token, body: { projectId: standaloneProjId, durationSeconds: 400, startedAt: nowIso, clientRequestId: randomUUID() } });
      const wsCProj = await api("/api/work-sessions", { method: "POST", token: tempMemberC.token, body: { projectId: standaloneProjId, durationSeconds: 200, startedAt: nowIso, clientRequestId: randomUUID() } });
      const wsB1 = await api("/api/work-sessions", { method: "POST", token: tempMemberB.token, body: { taskId: taskB.id, durationSeconds: 1000, startedAt: nowIso, clientRequestId: randomUUID() } });
      const wsB2 = await api("/api/work-sessions", { method: "POST", token: tempMemberB.token, body: { taskId: taskB.id, durationSeconds: 500, startedAt: nowIso, clientRequestId: randomUUID() } });
      const wsB3 = await api("/api/work-sessions", { method: "POST", token: tempMemberB.token, body: { taskId: taskB.id, durationSeconds: 300, startedAt: nowIso, clientRequestId: randomUUID() } });

      // ADMIN & SCRUM_ADMIN & SA personal work-session logging works
      const wsAdmProj = await api("/api/work-sessions", { method: "POST", token: tempAdmin.token, body: { projectId: standaloneProjId, durationSeconds: 300, startedAt: nowIso, clientRequestId: randomUUID() } });
      const wsScProj = await api("/api/work-sessions", { method: "POST", token: tempScrumAdmin.token, body: { projectId: standaloneProjId, durationSeconds: 250, startedAt: nowIso, clientRequestId: randomUUID() } });
      const wsSupProj = await api("/api/work-sessions", { method: "POST", token: tempSuperAdmin.token, body: { projectId: standaloneProjId, durationSeconds: 200, startedAt: nowIso, clientRequestId: randomUUID() } });

      assert([wsA1, wsA2, wsAProj, wsCProj, wsB1, wsB2, wsB3, wsAdmProj, wsScProj, wsSupProj].every((r) => r.status === 200 && r.json?.data?.id), "WorkSession logging failed");
      wsA1Id = wsA1.json.data.id;
      wsA2Id = wsA2.json.data.id;
      wsAProjId = wsAProj.json.data.id;
      wsBApprovedId = wsB1.json.data.id;
      wsBPendingId = wsB2.json.data.id;
      wsBRejectedId = wsB3.json.data.id;

      // Self-decision on WorkSession blocked for EVERYONE including SUPER_ADMIN!
      const rSelfSupWs = await api(`/api/work-sessions/${wsSupProj.json.data.id}/decision`, { method: "PATCH", token: tempSuperAdmin.token, body: { decision: "APPROVED" } });
      const rSelfAdmWs = await api(`/api/work-sessions/${wsAdmProj.json.data.id}/decision`, { method: "PATCH", token: tempAdmin.token, body: { decision: "APPROVED" } });
      assert(rSelfSupWs.status === 403 && rSelfAdmWs.status === 403, `Self work-session decision expected 403, got ${rSelfSupWs.status}/${rSelfAdmWs.status}`);

      // Reactivate sprint1 for leaderboard/dashboard checks
      await api(`/api/sprints/${sprint1.id}/status`, { method: "PATCH", token: tempScrumAdmin.token, body: { status: "ACTIVE" } });
      return `Logged sessions + self-decision 403 (SA/ADMIN) verified`;
    });

    await runCheck("TaskModeration", "SCRUM_ADMIN/ADMIN scrum task moderation vs project & cross-scrum 403", async () => {
      // SCRUM_ADMIN blocked from Project session & unassigned Scrum task session
      const rForbProj = await api(`/api/work-sessions/${wsAProjId}/decision`, { method: "PATCH", token: tempScrumAdmin.token, body: { decision: "APPROVED" } });
      assert(rForbProj.status === 403, `SCRUM_ADMIN project expected 403, got ${rForbProj.status}`);

      const rSeededSess = await api(`/api/work-sessions?targetType=TASK&userId=${member1Auth.user.id}`, { token: saAuth.token });
      const seededTaskSessId = rSeededSess.json?.data?.sessions?.[0]?.id;
      assert(seededTaskSessId, "Missing seeded Task session");
      const rForbCrossSc = await api(`/api/work-sessions/${seededTaskSessId}/decision`, { method: "PATCH", token: tempScrumAdmin.token, body: { decision: "APPROVED" } });
      assert(rForbCrossSc.status === 403, `SCRUM_ADMIN cross-scrum expected 403, got ${rForbCrossSc.status}`);

      // Unrelated ADMIN (AD0001) blocked from moderating tempScrumId Task session (only administers scrums they admin!)
      const rForbAdmTask = await api(`/api/work-sessions/${wsA1Id}/decision`, { method: "PATCH", token: adminAuth.token, body: { decision: "APPROVED" } });
      assert(rForbAdmTask.status === 403, `Unrelated ADMIN task moderation expected 403, got ${rForbAdmTask.status}`);

      // Scrum1 ADMIN (AD0002) CAN moderate Scrum1 seeded Task session; blocked on Scrum2 task session
      const rSc2Sess = await api(`/api/work-sessions?targetType=TASK&userId=${member2Auth.user.id}`, { token: saAuth.token });
      const scrum2TaskSess = rSc2Sess.json?.data?.sessions?.find((s) => s.task?.scrum?.id !== seededScrum1.id);
      const rAd2Ok = await api(`/api/work-sessions/${seededTaskSessId}/decision`, { method: "PATCH", token: adminScrumMemberAuth.token, body: { decision: "APPROVED" } });
      assert(rAd2Ok.status === 200, `Scrum1 ADMIN task moderation expected 200, got ${rAd2Ok.status}`);
      if (scrum2TaskSess) {
        const rAd2Cross = await api(`/api/work-sessions/${scrum2TaskSess.id}/decision`, { method: "PATCH", token: adminScrumMemberAuth.token, body: { decision: "APPROVED" } });
        assert(rAd2Cross.status === 403, `Scrum1 ADMIN cross-scrum expected 403, got ${rAd2Cross.status}`);
      }

      // tempScrumAdmin approves A (1000s) + B (1000s), rejects B (300s), leaving B 500s PENDING
      for (const id of [wsA1Id, wsA2Id, wsBApprovedId]) {
        const rApp = await api(`/api/work-sessions/${id}/decision`, { method: "PATCH", token: tempScrumAdmin.token, body: { decision: "APPROVED" } });
        assert(rApp.status === 200 && !hasOwn(rApp.json.data.user, "role"), `Decision ${id} failed`);
      }
      const rRej = await api(`/api/work-sessions/${wsBRejectedId}/decision`, { method: "PATCH", token: tempScrumAdmin.token, body: { decision: "REJECTED" } });
      assert(rRej.status === 200 && rRej.json.data.approval === "REJECTED", "Reject failed");

      // Studio ADMIN approves project session
      const rProjApp = await api(`/api/work-sessions/${wsAProjId}/decision`, { method: "PATCH", token: adminAuth.token, body: { decision: "APPROVED" } });
      assert(rProjApp.status === 200 && rProjApp.json.data.approval === "APPROVED", "Admin project approve failed");
      return "Scoped task moderation for SCRUM_ADMIN & ADMIN verified";
    });

    await runCheck("AttendanceRO & Impact", "SCRUM_ADMIN attendance is read-only (canDecide:false, 403 decide), impact & self-403", async () => {
      const { todayStr } = getTehranTodayAndWeekday();

      const rAttSc1 = await api(`/api/attendance/admin?date=${todayStr}&limit=100`, { token: tempScrumAdmin.token });
      assert(rAttSc1.status === 200 && Array.isArray(rAttSc1.json?.data), `SCRUM_ADMIN attendance failed: ${rAttSc1.status}`);
      const sc1UserIds = new Set(rAttSc1.json.data.map((r) => r.user.id));
      assert(
        sc1UserIds.size === 3 &&
          sc1UserIds.has(tempMemberA.id) &&
          sc1UserIds.has(tempMemberB.id) &&
          sc1UserIds.has(tempMemberC.id) &&
          !sc1UserIds.has(outsiderAuth.user.id) &&
          !sc1UserIds.has(tempAdmin.id) &&
          !sc1UserIds.has(tempScrumAdmin.id),
        `Unexpected users in SCRUM_ADMIN attendance: ${JSON.stringify([...sc1UserIds])}`
      );
      assert(
        rAttSc1.json.data.every(
          (r) =>
            !hasOwn(r.user, "role") &&
            r.canDecide === false &&
            Array.isArray(r.scrums) &&
            r.scrums.every((s) => s.id === tempScrumId) &&
            hasOwn(r, "workNote") &&
            hasOwn(r, "workNoteAt")
        ),
        "SCRUM_ADMIN attendance row fields (canDecide:false / scrums / workNote) mismatch"
      );

      const rowA1 = rAttSc1.json.data.find((r) => r.user.id === tempMemberA.id);
      assert(rowA1?.sessionsCount === 2 && rowA1?.totalSeconds === 1000, `Expected scoped 1000s, got ${JSON.stringify(rowA1)}`);

      // §4 Read-only SCRUM_ADMIN -> 403 on PATCH /decision (even for managed member C)
      const rScDecideForb = await api(`/api/attendance/admin/${attCId}/decision`, {
        method: "PATCH",
        token: tempScrumAdmin.token,
        body: { decision: "APPROVED" },
      });
      assert(rScDecideForb.status === 403, `SCRUM_ADMIN attendance decision expected 403, got ${rScDecideForb.status}`);

      // Nobody can decide own attendance (even SUPER_ADMIN & ADMIN)
      const rSelfSaAtt = await api(`/api/attendance/admin/${attTempSuperId}/decision`, {
        method: "PATCH",
        token: tempSuperAdmin.token,
        body: { decision: "APPROVED" },
      });
      const rSelfAdmAtt = await api(`/api/attendance/admin/${attTempAdminId}/decision`, {
        method: "PATCH",
        token: tempAdmin.token,
        body: { decision: "APPROVED" },
      });
      assert(rSelfSaAtt.status === 403 && rSelfAdmAtt.status === 403, `Self attendance decide expected 403, got ${rSelfSaAtt.status}/${rSelfAdmAtt.status}`);

      // Studio ADMIN sees all sessions (1400s) + canDecide: true for non-self non-SA
      const rAttAdm = await api(`/api/attendance/admin?date=${todayStr}&userId=${tempMemberA.id}`, { token: adminAuth.token });
      assert(
        rAttAdm.status === 200 &&
          rAttAdm.json.data[0]?.sessionsCount === 3 &&
          rAttAdm.json.data[0]?.totalSeconds === 1400 &&
          rAttAdm.json.data[0]?.canDecide === true,
        `Studio ADMIN attendance mismatch: ${JSON.stringify(rAttAdm.json?.data?.[0])}`
      );

      // NEW GET /api/attendance/admin/:id/impact
      const rImpForb = await api(`/api/attendance/admin/${attAId}/impact`, { token: tempScrumAdmin.token });
      const rImpAdm = await api(`/api/attendance/admin/${attAId}/impact`, { token: adminAuth.token });
      assert(rImpForb.status === 403, `SCRUM_ADMIN /impact expected 403, got ${rImpForb.status}`);
      assert(
        rImpAdm.status === 200 &&
          rImpAdm.json.data.sessionCount === 3 &&
          rImpAdm.json.data.totalSeconds === 1400 &&
          rImpAdm.json.data.taskSessionCount === 2 &&
          rImpAdm.json.data.projectSessionCount === 1 &&
          rImpAdm.json.data.alreadyRejected === false,
        `Attendance impact mismatch: ${JSON.stringify(rImpAdm.json?.data)}`
      );

      return "SCRUM_ADMIN read-only 403, self-403 & impact(3/1400s) verified";
    });

    await runCheck("WorkNote", "PUT /api/attendance/today/work-note XOR & GET /today + /me serialization", async () => {
      const rBadXor1 = await api("/api/attendance/today/work-note", { method: "PUT", token: tempMemberA.token, body: { text: "Hi", skipped: true } });
      const rBadXor2 = await api("/api/attendance/today/work-note", { method: "PUT", token: tempMemberA.token, body: {} });
      assert(rBadXor1.status === 400 && rBadXor2.status === 400, `XOR expected 400, got ${rBadXor1.status}/${rBadXor2.status}`);

      // Skip first
      const rSkip = await api("/api/attendance/today/work-note", { method: "PUT", token: tempMemberB.token, body: { skipped: true } });
      assert(rSkip.status === 200 && rSkip.json.data.workNotePrompted === true && rSkip.json.data.workNote === null, "WorkNote skip failed");

      // Save text
      const noteText = "تست یکپارچه‌سازی اندپوینت‌ها با موفقیت تکمیل شد.";
      const rSave = await api("/api/attendance/today/work-note", { method: "PUT", token: tempMemberA.token, body: { text: noteText } });
      assert(rSave.status === 200 && rSave.json.data.workNote === noteText && rSave.json.data.workNotePrompted === true && !hasOwn(rSave.json.data, "workNotePromptedAt"), "WorkNote save failed");

      const rToday = await api("/api/attendance/today", { token: tempMemberA.token });
      const rMe = await api("/api/attendance/me?limit=5", { token: tempMemberA.token });
      assert(
        rToday.status === 200 &&
          rToday.json.data.workNote === noteText &&
          rToday.json.data.workNotePrompted === true &&
          !hasOwn(rToday.json.data, "workNotePromptedAt"),
        "GET /today workNote mismatch"
      );
      assert(
        rMe.status === 200 &&
          rMe.json.data[0]?.workNote === noteText &&
          rMe.json.data[0]?.workNotePrompted === true &&
          !hasOwn(rMe.json.data[0], "workNotePromptedAt"),
        "GET /attendance/me workNote mismatch"
      );
      return "workNote XOR, /today, /me & no workNotePromptedAt verified";
    });

    // ---------------------------------------------------------
    // I. Work-Log Views, Scrum Report, Leaderboard (with ADMIN members), Dashboard
    // ---------------------------------------------------------
    await runCheck("WorkLogView", "Task/Project work-sessions & GET /api/tasks/mine (USER + ADMIN scrum member)", async () => {
      const { todayStr } = getTehranTodayAndWeekday();

      const rTaskBEd = await api(`/api/tasks/${taskB.id}/work-sessions?dateFrom=${todayStr}&dateTo=${todayStr}&approval=ALL`, { token: tempScrumAdmin.token });
      const dB = rTaskBEd.json.data;
      assert(rTaskBEd.status === 200 && dB.summary.approvedSeconds === 1000 && dB.summary.pendingSeconds === 500 && dB.summary.rejectedSeconds === 300, "TaskB 3-status summary mismatch");
      assert(findCodeKeys(rTaskBEd.json).length === 0, "Leaked code key");

      // USER privacy
      const rTaskAMemB = await api(`/api/tasks/${taskA.id}/work-sessions`, { token: tempMemberB.token });
      const rTaskAMemCross = await api(`/api/tasks/${taskA.id}/work-sessions?userId=${tempMemberA.id}`, { token: tempMemberB.token });
      assert(rTaskAMemB.status === 200 && rTaskAMemB.json.data.sessions.length === 0 && rTaskAMemB.json.data.permissions.canViewAllUsers === false, "Plain USER saw teammate sessions");
      assert(rTaskAMemCross.status === 403, "USER ?userId=other expected 403");

      // /api/tasks/mine works for member & AD0002; empty for unrelated ADMIN (AD0001)
      const rMyTasksAd1 = await api("/api/tasks/mine", { token: adminAuth.token });
      assert(rMyTasksAd1.status === 200 && rMyTasksAd1.json.data.tasks.length === 0, "AD0001 /api/tasks/mine expected empty");

      const rMyTasks = await api(`/api/tasks/mine?scrumId=${tempScrumId}&date=${todayStr}`, { token: tempMemberA.token });
      assert(rMyTasks.status === 200 && rMyTasks.json.data.tasks.some((t) => t.id === taskA.id && t.trackedSeconds.approved === 1000), "/api/tasks/mine mismatch");

      // Standalone Project read-only view for member vs ADMIN (includes A 400s + C 200s + tempAdmin 300s + tempScrumAdmin 250s + tempSuperAdmin 200s = 1350s)
      const rProjMemView = await api(`/api/projects/${standaloneProjId}/work-sessions?date=${todayStr}`, { token: tempMemberA.token });
      assert(rProjMemView.status === 200 && rProjMemView.json.data.summary.totalSeconds === 1350 && rProjMemView.json.data.permissions.canModerate === false, "Project member view mismatch");
      return "Work-log views & /tasks/mine verified";
    });

    await runCheck("Report & Targets", "Scrum report & scoped /work-sessions targets", async () => {
      const rMemRep = await api(`/api/scrums/${tempScrumId}/report`, { token: tempMemberB.token });
      const rEdRep = await api(`/api/scrums/${tempScrumId}/report`, { token: tempScrumAdmin.token });
      assert(rMemRep.status === 403 && rEdRep.status === 200, "Report RBAC failed");
      assert(rEdRep.json.data.total.totalSeconds === 2500 && rEdRep.json.data.total.totalTasks === 3 && rEdRep.json.data.total.activeTasks === 2, "Report totals mismatch");

      // SCRUM_ADMIN /work-sessions strictly excludes Project sessions
      const rScSess = await api("/api/work-sessions?limit=100", { token: tempScrumAdmin.token });
      const rScBypassProj = await api("/api/work-sessions?targetType=PROJECT", { token: tempScrumAdmin.token });
      assert(rScSess.status === 200 && rScSess.json.data.sessions.length === 5 && rScSess.json.data.sessions.every((s) => s.targetType === "TASK"), "SCRUM_ADMIN sessions leak");
      assert(rScBypassProj.status === 200 && rScBypassProj.json.data.sessions.length === 0, "SCRUM_ADMIN project bypass leak");
      return "Report (2500s) & scoped /work-sessions verified";
    });

    await runCheck("Leaderboard", "ADMIN member participates in leaderboard; SUPER_ADMIN stays excluded", async () => {
      // Seeded Scrum 1 includes AD0002 (ADMIN + member) and ranks IT1102 at #1, IT1101 with approved & pending
      const lbSeeded = await api(`/api/scrums/${seededScrum1.id}/leaderboard?period=ALL`, { token: member1Auth.token });
      assert(lbSeeded.status === 200, `Seeded leaderboard failed: ${lbSeeded.status}`);
      assert(lbSeeded.json.data.rows[0]?.user.id === member2Auth.user.id, "Expected IT1102 at #1");
      assert(lbSeeded.json.data.rows.some((r) => r.user.id === adminScrumMemberAuth.user.id && r.approvedSeconds > 0), "AD0002 (ADMIN member) missing from Scrum 1 leaderboard");
      assert(lbSeeded.json.data.me.approvedSeconds > 0 && lbSeeded.json.data.me.pendingSeconds > 0, "IT1101 me mismatch");

      // TempScrum leaderboard 1,1,3 ties & SUPER_ADMIN excluded
      for (const period of ["SPRINT", "MONTH", "ALL"]) {
        const lbB = await api(`/api/scrums/${tempScrumId}/leaderboard?period=${period}`, { token: tempMemberB.token });
        assert(lbB.status === 200 && lbB.json.data.rows.length === 3, `${period} rows mismatch`);
        assert(lbB.json.data.rows[0].rank === 1 && lbB.json.data.rows[1].rank === 1 && lbB.json.data.rows[2].rank === 3, `${period} tie ranks mismatch`);
        assert(lbB.json.data.me.rank === 1 && lbB.json.data.me.approvedSeconds === 1000 && lbB.json.data.me.pendingSeconds === 500, `${period} B.me mismatch`);
      }

      const lbSa = await api(`/api/scrums/${tempScrumId}/leaderboard?period=SPRINT`, { token: saAuth.token });
      assert(lbSa.status === 200 && lbSa.json.data.me.rank === null && lbSa.json.data.me.approvedSeconds === 0, "SUPER_ADMIN must stay excluded");
      assert(findCodeKeys(lbSeeded.json).length === 0, "Leaked code key");
      return "ADMIN participant + SUPER_ADMIN excluded + 1,1,3 ties verified";
    });

    await runCheck("Dashboard", "GET /api/scrum-admin/dashboard task/points counts & deduplicated members", async () => {
      const rForbU = await api("/api/scrum-admin/dashboard", { token: tempMemberA.token });
      const rForbA = await api("/api/scrum-admin/dashboard", { token: adminAuth.token });
      assert(rForbU.status === 403 && rForbA.status === 403, "Expected 403 for USER & unrelated ADMIN");

      const rAdm = await api("/api/scrum-admin/dashboard", { token: tempScrumAdmin.token });
      const d = rAdm.json.data;
      assert(rAdm.status === 200 && d.totals.scrums === 1 && d.totals.members === 3 && d.totals.activeSprints === 1, `Totals mismatch: ${JSON.stringify(d.totals)}`);
      assert(d.totals.activeTasks === 2 && d.totals.totalTasks === 3 && d.totals.totalTaskPoints === 16, "Task totals mismatch");
      assert(d.scrums[0].activeSprint?.progressPercent === 60 && d.todayEvents.length === 2, "Dashboard details mismatch");

      const rSaDash = await api("/api/scrum-admin/dashboard", { token: saAuth.token });
      const sumCounts = rSaDash.json.data.scrums.reduce((acc, s) => acc + s.memberCount, 0);
      assert(rSaDash.json.data.totals.members < sumCounts, "Member deduplication failed");
      return `totals verified (members=${d.totals.members}, pts=${d.totals.totalTaskPoints})`;
    });

    // ---------------------------------------------------------
    // J. §6 Two-Level Performance Status & Key Omission
    // ---------------------------------------------------------
    await runCheck("Performance", "Two-level performance status CRUD, 404/403 guards & strict Object.hasOwn omission", async () => {
      // SCRUM_ADMIN gets 404 on Studio performance
      const rStudioSc404 = await api(`/api/users/${tempMemberA.id}/performance`, { method: "PUT", token: tempScrumAdmin.token, body: { level: "STRONG" } });
      assert(rStudioSc404.status === 404, `SCRUM_ADMIN PUT /users/:id/performance expected 404, got ${rStudioSc404.status}`);

      // Self evaluation blocked 403 on both levels (including SA)
      const rSelfStudio = await api(`/api/users/${saAuth.user.id}/performance`, { method: "PUT", token: saAuth.token, body: { level: "EXCELLENT" } });
      const rSelfScrum = await api(`/api/scrums/${seededScrum1.id}/members/${scrumAdminAuth.user.id}/performance`, { method: "PUT", token: scrumAdminAuth.token, body: { level: "EXCELLENT" } });
      assert(rSelfStudio.status === 403 && rSelfScrum.status === 403, `Self performance expected 403, got ${rSelfStudio.status}/${rSelfScrum.status}`);

      // Set & clear Scrum-level performance on tempMemberA
      const rSetScrumPerf = await api(`/api/scrums/${tempScrumId}/members/${tempMemberA.id}/performance`, {
        method: "PUT",
        token: tempScrumAdmin.token,
        body: { level: "STRONG", note: "عالی در اسپرینت تست" },
      });
      assert(rSetScrumPerf.status === 200 && rSetScrumPerf.json.data.performance === "STRONG", "Set scrum performance failed");

      // Set Studio-level performance on tempMemberA by ADMIN
      const rSetStudioPerf = await api(`/api/users/${tempMemberA.id}/performance`, {
        method: "PUT",
        token: adminAuth.token,
        body: { level: "EXCELLENT", note: "نظم حضور کامل" },
      });
      assert(rSetStudioPerf.status === 200 && rSetStudioPerf.json.data.studioPerformance?.level === "EXCELLENT", "Set studio performance failed");

      // Check strict key omission!
      // 1. Plain member tempMemberA sees NO performance on members/leaderboard/profile
      const rMemListSelf = await api(`/api/scrums/${tempScrumId}/members`, { token: tempMemberA.token });
      const rMemLbSelf = await api(`/api/scrums/${tempScrumId}/leaderboard?period=ALL`, { token: tempMemberA.token });
      const rProfSelf = await api("/api/members/me/profile", { token: tempMemberA.token });
      assert(
        rMemListSelf.json.data.every((m) => !hasOwn(m, "performance") && !hasOwn(m, "performanceNote")),
        "Member /scrums/:id/members leaked performance keys!"
      );
      assert(
        rMemLbSelf.json.data.rows.every((r) => !hasOwn(r, "performance")) && !hasOwn(rMemLbSelf.json.data.me, "performance"),
        "Leaderboard leaked performance to plain member!"
      );
      assert(
        !hasOwn(rProfSelf.json.data.user, "studioPerformance") &&
          rProfSelf.json.data.memberships.every((m) => !hasOwn(m, "performance")),
        "Self profile leaked performance keys!"
      );

      // 2. SCRUM_ADMIN sees Scrum-level performance on tempScrumId members/leaderboard/profile, NEVER studioPerformance!
      const rScMemList = await api(`/api/scrums/${tempScrumId}/members?include=attendanceTotals`, { token: tempScrumAdmin.token });
      const rScProfileA = await api(`/api/members/${tempMemberA.id}/profile`, { token: tempScrumAdmin.token });
      const rowA = rScMemList.json.data.find((m) => m.id === tempMemberA.id);
      assert(
        rowA?.performance === "STRONG" &&
          typeof rowA?.attendanceTotals?.present === "number" &&
          !hasOwn(rowA, "code"),
        `Admin /scrums/:id/members performance/totals mismatch: ${JSON.stringify(rowA)}`
      );
      assert(
        !hasOwn(rScProfileA.json.data.user, "studioPerformance") &&
          rScProfileA.json.data.memberships.some((m) => m.scrumId === tempScrumId && m.performance === "STRONG"),
        "SCRUM_ADMIN profile leaked studioPerformance or missing scrum performance"
      );

      // 3. Unrelated ADMIN (AD0001) sees studioPerformance on /api/users, NEVER scrum performance via 404 on scrum
      const rAdmUsers = await api(`/api/users?search=${encodeURIComponent("Smoke Temp MemberA")}&include=attendanceTotals`, { token: adminAuth.token });
      const userARow = rAdmUsers.json.data.find((u) => u.id === tempMemberA.id);
      assert(
        userARow?.studioPerformance?.level === "EXCELLENT" &&
          !hasOwn(userARow, "code") &&
          typeof userARow?.attendanceTotals?.present === "number",
        `GET /api/users ADMIN studioPerformance/totals mismatch: ${JSON.stringify(userARow)}`
      );

      // Clear scrum performance cleanly
      const rClearScrumPerf = await api(`/api/scrums/${tempScrumId}/members/${tempMemberA.id}/performance`, {
        method: "PUT",
        token: tempScrumAdmin.token,
        body: { level: null },
      });
      assert(rClearScrumPerf.status === 200 && rClearScrumPerf.json.data.performance === null, "Clear scrum performance failed");
      return "Two-level CRUD, 404/403 & strict Object.hasOwn omission verified";
    });

    // ---------------------------------------------------------
    // K. §7 Member Detail & Calendar APIs
    // ---------------------------------------------------------
    await runCheck("MemberDetail & Cal", "GET /api/members/:userId/{profile,calendar,day,work} scope, calendar 62d & no code leaks", async () => {
      const { todayStr } = getTehranTodayAndWeekday();
      const from30 = shiftIsoDate(todayStr, -29);
      const tooWideFrom = shiftIsoDate(todayStr, -62); // 63 days inclusive -> 400

      // Calendar > 62 days -> 400
      const rCal63 = await api(`/api/members/me/calendar?from=${tooWideFrom}&to=${todayStr}`, { token: member1Auth.token });
      assert(rCal63.status === 400, `63-day calendar expected 400, got ${rCal63.status}`);

      // Regular member cannot inspect teammate
      const rUserOther = await api(`/api/members/${member2Auth.user.id}/profile`, { token: member1Auth.token });
      assert(rUserOther.status === 404, `Teammate inspecting another user expected 404, got ${rUserOther.status}`);

      // SCRUM_ADMIN (SC1101) cannot inspect outsider IT1103 or member solely in another scrum (AF1101 -> check AD0003/IT1103)
      const rScOutsider = await api(`/api/members/${outsiderAuth.user.id}/profile`, { token: scrumAdminAuth.token });
      assert(rScOutsider.status === 404, `SCRUM_ADMIN outsider expected 404, got ${rScOutsider.status}`);

      // SCRUM_ADMIN inspecting tempMemberA gets projectCount: 0 & projects: [] (studio projects hidden!)
      const rScCalA = await api(`/api/members/${tempMemberA.id}/calendar?from=${todayStr}&to=${todayStr}`, { token: tempScrumAdmin.token });
      const rScDayA = await api(`/api/members/${tempMemberA.id}/day?date=${todayStr}`, { token: tempScrumAdmin.token });
      const rScWorkA = await api(`/api/members/${tempMemberA.id}/work?from=${todayStr}&to=${todayStr}`, { token: tempScrumAdmin.token });
      assert(
        rScCalA.status === 200 &&
          rScCalA.json.data.days[0]?.projectCount === 0 &&
          rScCalA.json.data.days[0]?.taskCount === 1,
        `SCRUM_ADMIN calendar leaked projects: ${JSON.stringify(rScCalA.json?.data)}`
      );
      assert(
        rScDayA.status === 200 &&
          rScDayA.json.data.projects.length === 0 &&
          rScDayA.json.data.tasks.length === 1 &&
          rScDayA.json.data.attendance.workNote !== null,
        `SCRUM_ADMIN day leaked projects or missed workNote: ${JSON.stringify(rScDayA.json?.data)}`
      );
      assert(
        rScWorkA.status === 200 &&
          rScWorkA.json.data.sessions.length === 2 &&
          rScWorkA.json.data.sessions.every((s) => s.target.kind === "TASK"),
        "SCRUM_ADMIN /work leaked project sessions"
      );

      // Studio ADMIN inspecting tempMemberA sees ALL attendance, workNote, studio projects AND tasks, studioPerformance
      const rAdmProfA = await api(`/api/members/${tempMemberA.id}/profile`, { token: adminAuth.token });
      const rAdmCalA = await api(`/api/members/${tempMemberA.id}/calendar?from=${todayStr}&to=${todayStr}`, { token: adminAuth.token });
      const rAdmDayA = await api(`/api/members/${tempMemberA.id}/day?date=${todayStr}`, { token: adminAuth.token });
      assert(
        rAdmProfA.status === 200 &&
          rAdmProfA.json.data.user.studioPerformance?.level === "EXCELLENT" &&
          !hasOwn(rAdmProfA.json.data.user, "code") &&
          rAdmCalA.json.data.days[0]?.projectCount === 1 &&
          rAdmDayA.json.data.projects.length === 1,
        "Studio ADMIN member detail/calendar/day mismatch"
      );

      // Seeded 30-day calendar & SUPER_ADMIN zero-code check on IT1102
      const rSaCal = await api(`/api/members/${member2Auth.user.id}/calendar?from=${from30}&to=${todayStr}`, { token: saAuth.token });
      const rSaProf = await api(`/api/members/${member2Auth.user.id}/profile?scrumId=${seededScrum1.id}`, { token: saAuth.token });
      assert(rSaCal.status === 200 && rSaCal.json.data.days.length === 30, `Expected 30 calendar days, got ${rSaCal.json?.data?.days?.length}`);
      assert(rSaCal.json.data.totals.present >= 10 && rSaCal.json.data.totals.absent >= 1, "Seeded calendar totals look empty");
      assert(rSaProf.status === 200 && rSaProf.json.data.memberships.length === 1, "Profile scrumId filter mismatch");
      assert(
        findCodeKeys(rScCalA.json).length === 0 &&
          findCodeKeys(rAdmProfA.json).length === 0 &&
          findCodeKeys(rSaProf.json).length === 0,
        "Leaked code key in /api/members/* response!"
      );

      // ?include=attendanceTotals on /scrums/:id
      const rScWithTotals = await api(`/api/scrums/${tempScrumId}?include=attendanceTotals`, { token: tempScrumAdmin.token });
      assert(
        rScWithTotals.status === 200 &&
          rScWithTotals.json.data.members.every((m) => typeof m.attendanceTotals?.present === "number"),
        "?include=attendanceTotals on /scrums/:id failed"
      );
      return "profile, 30d calendar, 63d=400, day, work, include=attendanceTotals verified";
    });

    // ---------------------------------------------------------
    // L. Delete Cascade & Role/Active/Project Cache Invalidation
    // ---------------------------------------------------------
    await runCheck("DeleteCascade", "Task DELETE cascades WorkSessions; Scrum with taskB sessions stays 409; Sprint=200", async () => {
      const rTask200 = await api(`/api/tasks/${taskA.id}`, { method: "DELETE", token: tempScrumAdmin.token });
      assert(rTask200.status === 200, `Task DELETE cascade expected 200, got ${rTask200.status}`);

      const rSessAfter = await api(`/api/work-sessions?taskId=${taskA.id}`, { token: adminAuth.token });
      assert(rSessAfter.status === 200 && rSessAfter.json.data.sessions.length === 0, "Task sessions were not cascade-deleted");

      const rProjDel = await api(`/api/projects/${standaloneProjId}`, { method: "DELETE", token: saAuth.token });
      assert(rProjDel.status === 200, `Project delete failed: ${rProjDel.status}`);

      const rScr409 = await api(`/api/scrums/${tempScrumId}`, { method: "DELETE", token: saAuth.token });
      const rSpr200 = await api(`/api/sprints/${sprint2.id}`, { method: "DELETE", token: tempScrumAdmin.token });
      assert(rScr409.status === 409 && rSpr200.status === 200, `Scrum=409 / Sprint=200 mismatch: ${rScr409.status}/${rSpr200.status}`);
      return "Task cascade=200, Project=200, Scrum=409, Sprint=200";
    });

    await runCheck("CacheInvalidation", "SCRUM_ADMIN <-> ADMIN preserves ScrumAdmin; -> USER & isActive=false delete ScrumAdmin", async () => {
      // Promote tempMemberC -> SCRUM_ADMIN, add as Scrum 2 admin (alsoMember: false)
      const rProm = await api(`/api/users/${tempMemberC.id}`, { method: "PATCH", token: saAuth.token, body: { role: "SCRUM_ADMIN" } });
      assert(rProm.status === 200, `Promote failed: ${rProm.status}`);

      const rAddC = await api(`/api/scrums/${tempScrum2Id}/admins`, {
        method: "POST",
        token: saAuth.token,
        body: { userId: tempMemberC.id, alsoMember: false },
      });
      assert(rAddC.status === 201, `Add promoted C failed: ${rAddC.status}`);

      // Switch SCRUM_ADMIN -> ADMIN: MUST keep ScrumAdmin row!
      const rSwapToAdm = await api(`/api/users/${tempMemberC.id}`, { method: "PATCH", token: saAuth.token, body: { role: "ADMIN" } });
      assert(rSwapToAdm.status === 200, "SCRUM_ADMIN -> ADMIN failed");
      const rDashStillOk = await api("/api/scrum-admin/dashboard", { token: tempMemberC.token });
      assert(rDashStillOk.status === 200 && rDashStillOk.json.data.scrums.some((s) => s.id === tempScrum2Id), "SCRUM_ADMIN -> ADMIN lost ScrumAdmin");

      // Switch ADMIN -> USER: MUST delete ScrumAdmin row & invalidate cache immediately!
      const rDemUser = await api(`/api/users/${tempMemberC.id}`, { method: "PATCH", token: saAuth.token, body: { role: "USER" } });
      assert(rDemUser.status === 200, "ADMIN -> USER failed");

      const rDashBlocked = await api("/api/scrum-admin/dashboard", { token: tempMemberC.token });
      const rScrum2Gone = await api(`/api/scrums/${tempScrum2Id}`, { token: tempMemberC.token });
      assert(rDashBlocked.status === 403 && rScrum2Gone.status === 404, "Immediate demotion/cache invalidation failed");

      // Deactivating tempScrumAdmin2 cleans ScrumAdmin row while ScrumMember remains
      await api(`/api/users/${tempScrumAdmin2.id}`, { method: "PATCH", token: saAuth.token, body: { isActive: false } });
      const rCheckAdmins = await api(`/api/scrums/${tempScrum2Id}`, { token: saAuth.token });
      assert(
        rCheckAdmins.status === 200 &&
          rCheckAdmins.json.data.admins.length === 0 &&
          rCheckAdmins.json.data.members.some((m) => m.id === tempScrumAdmin2.id),
        "Deactivated admin ScrumAdmin cleanup or ScrumMember preservation failed"
      );
      return "SCRUM_ADMIN <-> ADMIN preserved + -> USER/deactivate cleanup verified";
    });
  } finally {
    if (saAuth?.token) {
      for (const pid of createdProjectIds) {
        await api(`/api/projects/${pid}`, { method: "DELETE", token: saAuth.token }).catch(() => {});
      }
      for (const uid of createdUserIds) {
        await api(`/api/users/${uid}`, { method: "DELETE", token: saAuth.token }).catch(() => {});
      }
      for (const sid of createdScrumIds) {
        await api(`/api/scrums/${sid}`, { method: "DELETE", token: saAuth.token }).catch(() => {});
      }
    }
  }

  const failures = printTable();
  process.exit(failures > 0 ? 1 : 0);
};

main().catch((err) => {
  console.error("Fatal error in scrum-smoke.mjs:", err);
  process.exit(1);
});
