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

const uniqueCode = (prefix) => {
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `${prefix}${rand}`.slice(0, 6);
};

const printTable = () => {
  const groupW = 18;
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
  let scrumAdminAuth = null;
  let scrumAdmin2Auth = null;
  let member1Auth = null;
  let member2Auth = null;
  let outsiderAuth = null;

  let tempScrumAdmin = null;
  let tempScrumAdmin2 = null;
  let tempMemberA = null;
  let tempMemberB = null;
  let tempMemberC = null;
  let seededScrum = null;
  let seededKpiList = [];
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

    await runCheck("Swagger", "GET /api-docs.json matches decoupled Project & Scrum Task API", async () => {
      const res = await api("/api-docs.json");
      assert(res.status === 200 && res.json && typeof res.json === "object", `Status=${res.status}`);
      const doc = res.json;

      const requiredPaths = [
        "/api/users/scrum-admins",
        "/api/projects",
        "/api/projects/{id}",
        "/api/projects/{id}/work-sessions",
        "/api/work-sessions",
        "/api/work-sessions/targets",
        "/api/work-sessions/summary",
        "/api/work-sessions/{id}/decision",
        "/api/scrums",
        "/api/scrums/today-events",
        "/api/scrums/{id}",
        "/api/scrums/{id}/admins",
        "/api/scrums/{id}/members",
        "/api/scrums/{id}/tasks",
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
      ];
      for (const p of requiredPaths) {
        assert(Boolean(doc.paths?.[p]), `Missing swagger path ${p}`);
      }

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
        "ScrumBrief",
        "ScrumPermissions",
        "ScrumResponse",
        "SprintResponse",
        "ScrumTaskItem",
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

    await runCheck("Setup", "Login seeded accounts (SP0001, AD0001, SC1101, SC1102, IT1101..IT1103)", async () => {
      saAuth = await login(process.env.SEED_SUPERADMIN_CODE || "SP0001");
      adminAuth = await login("AD0001");
      scrumAdminAuth = await login("SC1101");
      scrumAdmin2Auth = await login("SC1102");
      member1Auth = await login("IT1101");
      member2Auth = await login("IT1102");
      outsiderAuth = await login("IT1103");
      return "All 7 seeded roles logged in";
    });

    await runCheck("Setup", "Create & login isolated temp users for task/session/leaderboard tests", async () => {
      const specs = [
        { role: "SCRUM_ADMIN", name: "Smoke Temp ScrumAdmin1", prefix: "SA" },
        { role: "SCRUM_ADMIN", name: "Smoke Temp ScrumAdmin2", prefix: "SB" },
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
      [tempScrumAdmin, tempScrumAdmin2, tempMemberA, tempMemberB, tempMemberC] = created;
      return `ids=${created.map((u) => u.id).join(",")}`;
    });

    // ---------------------------------------------------------
    // A. Role List Filtering, Admins List & No-code Guarantee
    // ---------------------------------------------------------
    await runCheck("ListFiltering", "ADMIN gets 403 on GET /api/scrums and /today-events", async () => {
      const r1 = await api("/api/scrums", { token: adminAuth.token });
      const r2 = await api("/api/scrums/today-events", { token: adminAuth.token });
      assert(r1.status === 403, `GET /api/scrums expected 403, got ${r1.status}`);
      assert(r2.status === 403, `GET /api/scrums/today-events expected 403, got ${r2.status}`);
      return "Both 403";
    });

    await runCheck("UsersScrumAdmin", "GET /api/users/scrum-admins is SA-only, searchable, <=50 & leaks no code", async () => {
      const rForb = await api("/api/users/scrum-admins", { token: scrumAdminAuth.token });
      const rForbUser = await api("/api/users/scrum-admins", { token: tempMemberA.token });
      assert(rForb.status === 403 && rForbUser.status === 403, "Expected 403 for non-SA");

      const rSa = await api("/api/users/scrum-admins?q=Scrum", { token: saAuth.token });
      assert(rSa.status === 200 && Array.isArray(rSa.json?.data), `Status=${rSa.status}`);
      assert(rSa.json.data.length >= 4 && rSa.json.data.length <= 50, `Unexpected length ${rSa.json.data.length}`);
      assert(rSa.json.data.some((u) => u.id === scrumAdminAuth.user.id), "Missing SC1101");
      assert(rSa.json.data.some((u) => u.id === scrumAdmin2Auth.user.id), "Missing SC1102");
      assert(!rSa.json.data.some((u) => u.id === tempMemberA.id), "USER incorrectly included");
      assert(rSa.json.data.every((u) => Object.keys(u).sort().join(",") === "id,name"), "Extra keys leaked");
      assert(findCodeKeys(rSa.json).length === 0, "Leaked code key");
      return `hits=${rSa.json.data.length}`;
    });

    await runCheck("ListFiltering", "SCRUM_ADMIN sees assigned scrum with taskCount & progressPercent", async () => {
      const r = await api("/api/scrums", { token: scrumAdminAuth.token });
      assert(r.status === 200 && Array.isArray(r.json?.data), `Status=${r.status}`);
      seededScrum = r.json.data.find((s) =>
        Array.isArray(s.admins) && s.admins.some((a) => a.id === scrumAdminAuth.user.id)
      );
      assert(seededScrum, "Seeded scrum missing for SC1101");
      assert(!("ownerId" in seededScrum), "Legacy ownerId still present in Scrum item");
      assert(typeof seededScrum.taskCount === "number" && seededScrum.taskCount >= 3, "Missing/invalid taskCount");
      assert(seededScrum.myRole === "ADMIN" && seededScrum.canEdit === true, "myRole/canEdit mismatch");
      assert(
        seededScrum.permissions?.canEditContent === true &&
          seededScrum.permissions?.canManageAdmins === false &&
          seededScrum.permissions?.canArchive === false,
        `Unexpected permissions: ${JSON.stringify(seededScrum.permissions)}`
      );
      assert(seededScrum.activeSprint?.number === 1, "Expected seeded activeSprint #1");
      assert(typeof seededScrum.activeSprint?.progressPercent === "number", "Missing progressPercent on activeSprint");
      assert(findCodeKeys(r.json).length === 0, "Leaked code key");
      return `scrumId=${seededScrum.id}, tasks=${seededScrum.taskCount}, progress=${seededScrum.activeSprint.progressPercent}%`;
    });

    await runCheck("ListFiltering", "SC1102 sees >=2 scrums; IT1101 sees member scrum; outsider sees 0", async () => {
      const rSc2 = await api("/api/scrums", { token: scrumAdmin2Auth.token });
      assert(rSc2.status === 200 && rSc2.json.data.length >= 2, "SC1102 should see >= 2 scrums");

      const rMem = await api("/api/scrums", { token: member1Auth.token });
      const item = rMem.json.data.find((s) => s.id === seededScrum.id);
      assert(item && item.myRole === "MEMBER" && item.canEdit === false, "IT1101 myRole/canEdit mismatch");

      const rOut = await api("/api/scrums", { token: outsiderAuth.token });
      const rTemp = await api("/api/scrums", { token: tempScrumAdmin.token });
      assert(rOut.status === 200 && rOut.json.data.length === 0, "Outsider saw a scrum");
      assert(rTemp.status === 200 && rTemp.json.data.length === 0, "Unassigned SCRUM_ADMIN saw a scrum");

      const rSa = await api("/api/scrums", { token: saAuth.token });
      assert(
        rSa.status === 200 &&
          rSa.json.data.every(
            (s) =>
              s.myRole === "SUPER_ADMIN" &&
              s.permissions?.canEditContent === true &&
              s.permissions?.canManageAdmins === true &&
              s.permissions?.canArchive === true
          ),
        "Expected SA SUPER_ADMIN permissions on all"
      );

      const searchRes = await api("/api/users/search?q=Artin", { token: scrumAdminAuth.token });
      assert(searchRes.status === 200 && searchRes.json.data.length > 0, `Search status=${searchRes.status}`);
      assert(!("role" in searchRes.json.data[0]), "Leaked role to SCRUM_ADMIN in /api/users/search");
      assert(findCodeKeys(searchRes.json).length === 0, "Leaked code key in /api/users/search");
      return `SC1102=${rSc2.json.data.length}, IT1101=${rMem.json.data.length}`;
    });

    // ---------------------------------------------------------
    // B. KPI Secrecy on Seeded Scrum & Computation
    // ---------------------------------------------------------
    await runCheck("KPI", "Member GET KPIs omits minExpected key; Assigned Admin/SA see minExpected", async () => {
      const mRes = await api(`/api/scrums/${seededScrum.id}/kpis`, { token: member1Auth.token });
      const oRes = await api(`/api/scrums/${seededScrum.id}/kpis`, { token: scrumAdminAuth.token });
      const sRes = await api(`/api/scrums/${seededScrum.id}/kpis`, { token: saAuth.token });
      assert(mRes.status === 200 && mRes.json.data.length > 0, `Member KPI status=${mRes.status}`);
      assert(oRes.status === 200 && sRes.status === 200, "Admin/SA KPI fetch failed");

      for (const row of mRes.json.data) {
        assert(!Object.prototype.hasOwnProperty.call(row, "minExpected"), "LEAK: minExpected present for member");
      }
      const ownerRow = oRes.json.data[0];
      assert(Object.prototype.hasOwnProperty.call(ownerRow, "minExpected"), "Admin missing minExpected");
      assert(ownerRow.progressPercent === 94.12 && ownerRow.status === "IN_RANGE", "KPI computation mismatch");
      assert(sRes.json.data[0].minExpected === ownerRow.minExpected, "SA minExpected mismatch");
      seededKpiList = oRes.json.data;
      return `progress=${ownerRow.progressPercent}, status=${ownerRow.status}`;
    });

    // ---------------------------------------------------------
    // C. Scrum Permission Model, Creation, Admins, Members, IDOR & RBAC
    // ---------------------------------------------------------
    await runCheck("PermissionModel", "Only SUPER_ADMIN can create scrums; invalid adminIds -> 422", async () => {
      const rUser = await api("/api/scrums", { method: "POST", token: tempMemberA.token, body: { name: "Unauthorized" } });
      const rSaBlocked = await api("/api/scrums", { method: "POST", token: tempScrumAdmin.token, body: { name: "ScrumAdmin Cannot Create" } });
      const rAdmin = await api("/api/scrums", { method: "POST", token: adminAuth.token, body: { name: "Admin Cannot Create" } });
      const rBadAdminRole = await api("/api/scrums", { method: "POST", token: saAuth.token, body: { name: "Bad Admin", adminIds: [tempMemberA.id] } });
      assert(rUser.status === 403 && rSaBlocked.status === 403 && rAdmin.status === 403, "Expected 403 for non-SA");
      assert(rBadAdminRole.status === 422, `Invalid adminIds role expected 422, got ${rBadAdminRole.status}`);
      return "403 / 403 / 403 / 422";
    });

    await runCheck("ScrumCRUD", "SUPER_ADMIN creates tempScrum & tempScrum2 (union visibility)", async () => {
      const r1 = await api("/api/scrums", {
        method: "POST",
        token: saAuth.token,
        body: {
          name: "Smoke Test Scrum 1",
          description: "Initial desc",
          color: "COLLEGE",
          adminIds: [tempScrumAdmin.id],
        },
      });
      assert(r1.status === 201 && r1.json?.data?.id, `Create 1 failed: ${r1.status}`);
      tempScrumId = r1.json.data.id;
      createdScrumIds.push(tempScrumId);
      assert(r1.json.data.taskCount === 0, "Expected initial taskCount=0");

      const r2 = await api("/api/scrums", {
        method: "POST",
        token: saAuth.token,
        body: {
          name: "Smoke Test Scrum 2",
          color: "CLUB",
          adminIds: [tempScrumAdmin2.id],
        },
      });
      assert(r2.status === 201 && r2.json?.data?.id, `Create 2 failed: ${r2.status}`);
      tempScrum2Id = r2.json.data.id;
      createdScrumIds.push(tempScrum2Id);

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
      assert(s1?.myRole === "ADMIN" && s1?.canEdit === true, "Union: Scrum1 should be ADMIN");
      assert(s2?.myRole === "MEMBER" && s2?.canEdit === false, "Union: Scrum2 should be MEMBER");
      return `scrum1=${tempScrumId}(ADMIN), scrum2=${tempScrum2Id}(MEMBER)`;
    });

    await runCheck("PermissionModel", "PUT /admins Set Diffing, 403/422 guards & member sync", async () => {
      const rAdminsForb = await api(`/api/scrums/${tempScrumId}/admins`, { method: "PUT", token: tempScrumAdmin.token, body: { userIds: [tempScrumAdmin.id] } });
      const rArchiveForb = await api(`/api/scrums/${tempScrumId}`, { method: "PATCH", token: tempScrumAdmin.token, body: { isActive: false } });
      const rDelForb = await api(`/api/scrums/${tempScrumId}`, { method: "DELETE", token: tempScrumAdmin.token });
      const rAdminsBadRole = await api(`/api/scrums/${tempScrumId}/admins`, { method: "PUT", token: saAuth.token, body: { userIds: [tempMemberA.id] } });
      assert(rAdminsForb.status === 403 && rArchiveForb.status === 403 && rDelForb.status === 403, "Expected 403s");
      assert(rAdminsBadRole.status === 422, `Expected 422, got ${rAdminsBadRole.status}`);

      const rAdd = await api(`/api/scrums/${tempScrumId}/admins`, { method: "PUT", token: saAuth.token, body: { userIds: [tempScrumAdmin.id, tempScrumAdmin2.id] } });
      const rRev = await api(`/api/scrums/${tempScrumId}/admins`, { method: "PUT", token: saAuth.token, body: { userIds: [tempScrumAdmin.id] } });
      assert(rAdd.status === 200 && rAdd.json.data.length === 2 && rRev.status === 200 && rRev.json.data.length === 1, "Sync admins failed");

      const rOk = await api(`/api/scrums/${tempScrumId}/members`, {
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
      assert(rOk.status === 200 && rOk.json.data.length === 3, `Sync members expected 200/3, got ${rOk.status}`);
      return "Admins & 3 members synced";
    });

    await runCheck("IDOR & RBAC", "Outsider gets 404 & member gets 403 across scrum/task endpoints", async () => {
      const checks404 = [
        ["GET", `/api/scrums/${tempScrumId}`, outsiderAuth.token],
        ["PATCH", `/api/scrums/${tempScrumId}`, outsiderAuth.token, { name: "x" }],
        ["DELETE", `/api/scrums/${tempScrumId}`, outsiderAuth.token],
        ["PUT", `/api/scrums/${tempScrumId}/admins`, outsiderAuth.token, { userIds: [] }],
        ["PUT", `/api/scrums/${tempScrumId}/members`, outsiderAuth.token, { members: [] }],
        ["GET", `/api/scrums/${tempScrumId}/tasks`, outsiderAuth.token],
        ["POST", `/api/scrums/${tempScrumId}/tasks`, outsiderAuth.token, { name: "x" }],
        ["GET", `/api/scrums/${tempScrumId}/sprints`, outsiderAuth.token],
        ["POST", `/api/scrums/${tempScrumId}/sprints`, outsiderAuth.token, {}],
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
            { indicator: "Below Min", target: 100, minExpected: 50, actualValue: 30 },
            { indicator: "On Target", target: 100, minExpected: 50, actualValue: 100 },
          ],
        },
      });
      assert(rKpi.status === 200 && rKpi.json.data.length === 2, "KPI batch update failed");

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

    await runCheck("StandaloneProject", "Projects have no scrumId/scrum; GET /projects/:id/work-sessions is ADMIN/SA only", async () => {
      const rCreate = await api("/api/projects", {
        method: "POST",
        token: saAuth.token,
        body: {
          name: "Smoke Standalone Studio Project",
          description: "Pure Studio Project (decoupled from Scrum)",
          memberIds: [tempMemberA.id, outsiderAuth.user.id],
        },
      });
      assert(rCreate.status === 201 && rCreate.json?.data?.id, `Create project failed: ${rCreate.status}`);
      assert(!("scrumId" in rCreate.json.data) && !("scrum" in rCreate.json.data), "Project response still contains scrumId/scrum!");
      standaloneProjId = rCreate.json.data.id;
      createdProjectIds.push(standaloneProjId);

      // List & detail also omit scrumId/scrum
      const rGet = await api(`/api/projects/${standaloneProjId}`, { token: adminAuth.token });
      assert(rGet.status === 200 && !("scrumId" in rGet.json.data) && !("scrum" in rGet.json.data), "GET /projects/:id still has scrumId");

      // SCRUM_ADMIN and USER get 403 on GET /api/projects/:id/work-sessions
      const rForbSc = await api(`/api/projects/${standaloneProjId}/work-sessions`, { token: tempScrumAdmin.token });
      const rForbMem = await api(`/api/projects/${standaloneProjId}/work-sessions`, { token: tempMemberA.token });
      assert(rForbSc.status === 403 && rForbMem.status === 403, `Expected 403s, got ${rForbSc.status}/${rForbMem.status}`);

      // ADMIN and SUPER_ADMIN get 200
      const rAdm = await api(`/api/projects/${standaloneProjId}/work-sessions`, { token: adminAuth.token });
      assert(rAdm.status === 200 && rAdm.json.data.target.kind === "PROJECT", "ADMIN GET /projects/:id/work-sessions failed");
      return `projectId=${standaloneProjId} decoupled`;
    });

    // ---------------------------------------------------------
    // F. Simplified Sprints (Reversible Phases & Manual progressPercent)
    // ---------------------------------------------------------
    let sprint1 = null;
    let sprint2 = null;
    let sprint3 = null;

    await runCheck("SimpleSprints", "Concurrent create, progressPercent validation (0..100) & bidirectional phase transitions", async () => {
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
        assert(!("totalPoints" in r.json.data) && !("projects" in r.json.data), "Legacy sprint item fields still present");
      }

      const sprintsList = await api(`/api/scrums/${tempScrumId}/sprints`, { token: tempScrumAdmin.token });
      const numbers = sprintsList.json.data.map((s) => s.number);
      assert(JSON.stringify(numbers) === JSON.stringify([1, 2, 3]), `Expected [1,2,3], got ${JSON.stringify(numbers)}`);
      [sprint1, sprint2, sprint3] = sprintsList.json.data;

      // Single ACTIVE concurrency check
      const [a1, a2] = await Promise.all([
        api(`/api/sprints/${sprint1.id}/status`, { method: "PATCH", token: tempScrumAdmin.token, body: { status: "ACTIVE" } }),
        api(`/api/sprints/${sprint2.id}/status`, { method: "PATCH", token: tempScrumAdmin.token, body: { status: "ACTIVE" } }),
      ]);
      const statuses = [a1.status, a2.status].sort((x, y) => x - y);
      assert(statuses[0] === 200 && statuses[1] === 409, `Expected [200, 409], got [${statuses.join(",")}]`);
      sprint1 = a1.status === 200 ? a1.json.data : a2.json.data;

      // Reversible phase checks: ACTIVE -> COMPLETED -> ACTIVE -> PLANNED -> ACTIVE
      const tComp = await api(`/api/sprints/${sprint1.id}/status`, { method: "PATCH", token: tempScrumAdmin.token, body: { status: "COMPLETED" } });
      assert(tComp.status === 200 && tComp.json.data.status === "COMPLETED" && tComp.json.data.completedAt !== null, "To COMPLETED failed");

      const tBackActive = await api(`/api/sprints/${sprint1.id}/status`, { method: "PATCH", token: tempScrumAdmin.token, body: { status: "ACTIVE" } });
      assert(tBackActive.status === 200 && tBackActive.json.data.status === "ACTIVE" && tBackActive.json.data.completedAt === null, "COMPLETED -> ACTIVE revert failed");

      const tBackPlanned = await api(`/api/sprints/${sprint1.id}/status`, { method: "PATCH", token: tempScrumAdmin.token, body: { status: "PLANNED" } });
      assert(tBackPlanned.status === 200 && tBackPlanned.json.data.status === "PLANNED", "ACTIVE -> PLANNED revert failed");

      // Update manual progressPercent + start/end dates
      const rPatchNeg = await api(`/api/sprints/${sprint1.id}`, { method: "PATCH", token: tempScrumAdmin.token, body: { progressPercent: -5 } });
      assert(rPatchNeg.status === 400, `progressPercent=-5 expected 400, got ${rPatchNeg.status}`);

      const { todayStr } = getTehranTodayAndWeekday();
      const rPatch = await api(`/api/sprints/${sprint1.id}`, {
        method: "PATCH",
        token: tempScrumAdmin.token,
        body: { startDate: todayStr, endDate: todayStr, progressPercent: 60 },
      });
      assert(rPatch.status === 200 && rPatch.json.data.progressPercent === 60 && rPatch.json.data.startDate === todayStr, "Sprint patch progressPercent failed");
      sprint1 = rPatch.json.data;

      // Cleanly delete unused sprint3
      const rDelS3 = await api(`/api/sprints/${sprint3.id}`, { method: "DELETE", token: tempScrumAdmin.token });
      assert(rDelS3.status === 200, `Delete sprint3 failed: ${rDelS3.status}`);
      return `sprint1=${sprint1.id}, reversible phases + progress=60%`;
    });

    // ---------------------------------------------------------
    // G. Scrum Tasks (Task + TaskMember) & Work Targets without Active Sprint
    // ---------------------------------------------------------
    let taskA = null;
    let taskB = null;
    let taskInactive = null;
    let taskSpare = null;

    await runCheck("ScrumTasks", "Task CRUD, multi-member sync (422 outsider), Scrum member removal cleanup & WorkTargets with 0 active sprints", async () => {
      // Outsider in memberIds -> 422
      const rBadMem = await api(`/api/scrums/${tempScrumId}/tasks`, {
        method: "POST",
        token: tempScrumAdmin.token,
        body: { name: "Invalid Assignee Task", points: 3, memberIds: [outsiderAuth.user.id] },
      });
      assert(rBadMem.status === 422, `Outsider member expected 422, got ${rBadMem.status}`);

      const rA = await api(`/api/scrums/${tempScrumId}/tasks`, {
        method: "POST",
        token: tempScrumAdmin.token,
        body: {
          name: "Task Alpha",
          description: "Core scrum task",
          points: 5,
          isActive: true,
          memberIds: [tempMemberA.id, tempMemberB.id],
        },
      });
      const rB = await api(`/api/scrums/${tempScrumId}/tasks`, {
        method: "POST",
        token: tempScrumAdmin.token,
        body: {
          name: "Task Beta",
          points: 8,
          isActive: true,
          memberIds: [tempMemberB.id],
        },
      });
      const rInact = await api(`/api/scrums/${tempScrumId}/tasks`, {
        method: "POST",
        token: tempScrumAdmin.token,
        body: {
          name: "Task Inactive",
          points: 3,
          isActive: false,
          memberIds: [tempMemberA.id],
        },
      });
      const rSpare = await api(`/api/scrums/${tempScrumId}/tasks`, {
        method: "POST",
        token: tempScrumAdmin.token,
        body: {
          name: "Task Spare",
          points: 2,
          isActive: true,
          memberIds: [tempMemberC.id],
        },
      });

      assert(rA.status === 201 && rB.status === 201 && rInact.status === 201 && rSpare.status === 201, "Create task failed");
      taskA = rA.json.data;
      taskB = rB.json.data;
      taskInactive = rInact.json.data;
      taskSpare = rSpare.json.data;
      assert(taskA.members.length === 2 && taskA.points === 5, "Task Alpha fields mismatch");

      // Sync members on taskSpare: 422 outsider, then assign A+C, then test ScrumMember removal auto-cleanup
      const rBadSync = await api(`/api/tasks/${taskSpare.id}/members`, {
        method: "PUT",
        token: tempScrumAdmin.token,
        body: { userIds: [outsiderAuth.user.id] },
      });
      assert(rBadSync.status === 422, `Expected 422 on PUT /tasks/:id/members outsider, got ${rBadSync.status}`);

      // Temporarily remove tempMemberC from Scrum -> verify TaskMember cleanup -> restore tempMemberC
      await api(`/api/scrums/${tempScrumId}/members`, {
        method: "PUT",
        token: tempScrumAdmin.token,
        body: {
          members: [
            { userId: tempMemberA.id, label: "عضو الف" },
            { userId: tempMemberB.id, label: "عضو ب" },
          ],
        },
      });
      const rCheckSpare = await api(`/api/tasks/${taskSpare.id}`, { token: tempScrumAdmin.token });
      assert(rCheckSpare.status === 200 && rCheckSpare.json.data.members.length === 0, "Removing ScrumMember did not clean up TaskMember");

      await api(`/api/scrums/${tempScrumId}/members`, {
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

      // Update taskSpare & delete cleanly (no sessions yet -> 200)
      const rPatchSpare = await api(`/api/tasks/${taskSpare.id}`, {
        method: "PATCH",
        token: tempScrumAdmin.token,
        body: { name: "Task Spare Updated", points: 4 },
      });
      assert(rPatchSpare.status === 200 && rPatchSpare.json.data.points === 4, "Task PATCH failed");
      const rDelSpare = await api(`/api/tasks/${taskSpare.id}`, { method: "DELETE", token: tempScrumAdmin.token });
      assert(rDelSpare.status === 200, `Empty task DELETE failed: ${rDelSpare.status}`);

      // Verify GET /api/work-targets/mine includes active Task even though ALL sprints in tempScrumId are PLANNED right now (sprint: null)!
      const wtA = await api("/api/work-targets/mine", { token: tempMemberA.token });
      assert(wtA.status === 200, `work-targets failed: ${wtA.status}`);
      const grp = wtA.json.data.scrums.find((g) => g.scrum.id === tempScrumId);
      assert(grp && grp.sprint === null, "Expected grp.sprint=null while sprints are PLANNED");
      assert(grp.tasks.some((t) => t.id === taskA.id), "Active task missing from work-targets/mine when no sprint is ACTIVE");
      assert(!grp.tasks.some((t) => t.id === taskInactive.id), "Inactive task leaked into work-targets/mine");
      assert(wtA.json.data.studioProjects.some((p) => p.id === standaloneProjId), "Studio project missing from studioProjects");

      return `tasks=${taskA.id},${taskB.id},${taskInactive.id}`;
    });

    // ---------------------------------------------------------
    // H. Logging on Task without Active Sprint + Work-Log View + Moderation Privacy
    // ---------------------------------------------------------
    let wsA1Id = null;
    let wsA2Id = null;
    let wsAProjId = null;
    let wsBApprovedId = null;
    let wsBPendingId = null;
    let wsBRejectedId = null;

    await runCheck("WorkSessionTask", "Log Task session with 0 ACTIVE sprints; reject XOR/inactive/unassigned/ADMIN", async () => {
      const attA = await api("/api/attendance/today", { method: "POST", token: tempMemberA.token, body: { status: "PRESENT" } });
      const attB = await api("/api/attendance/today", { method: "POST", token: tempMemberB.token, body: { status: "PRESENT" } });
      await api("/api/attendance/today", { method: "POST", token: tempMemberC.token, body: { status: "PRESENT" } });
      assert(attA.json?.data?.id && attB.json?.data?.id, "Attendance failed");

      await api(`/api/attendance/admin/${attA.json.data.id}/decision`, { method: "PATCH", token: adminAuth.token, body: { decision: "APPROVED" } });
      await api(`/api/attendance/admin/${attB.json.data.id}/decision`, { method: "PATCH", token: adminAuth.token, body: { decision: "APPROVED" } });

      const nowIso = new Date().toISOString();

      // XOR & guard checks
      const rBoth = await api("/api/work-sessions", {
        method: "POST",
        token: tempMemberA.token,
        body: { projectId: standaloneProjId, taskId: taskA.id, durationSeconds: 100, startedAt: nowIso, clientRequestId: randomUUID() },
      });
      const rNeither = await api("/api/work-sessions", {
        method: "POST",
        token: tempMemberA.token,
        body: { durationSeconds: 100, startedAt: nowIso, clientRequestId: randomUUID() },
      });
      const rInactive = await api("/api/work-sessions", {
        method: "POST",
        token: tempMemberA.token,
        body: { taskId: taskInactive.id, durationSeconds: 100, startedAt: nowIso, clientRequestId: randomUUID() },
      });
      const rUnassigned = await api("/api/work-sessions", {
        method: "POST",
        token: tempMemberC.token,
        body: { taskId: taskA.id, durationSeconds: 100, startedAt: nowIso, clientRequestId: randomUUID() },
      });
      assert(rBoth.status === 422 && rNeither.status === 422, `XOR expected 422, got ${rBoth.status}/${rNeither.status}`);
      assert(rInactive.status === 400, `Inactive task expected 400, got ${rInactive.status}`);
      assert(rUnassigned.status === 403, `Unassigned member expected 403, got ${rUnassigned.status}`);

      // tempMemberA logs 600s + 400s on taskA WHILE sprint1 is STILL PLANNED (no active sprint!) + 400s on standaloneProjId
      const wsA1 = await api("/api/work-sessions", {
        method: "POST",
        token: tempMemberA.token,
        body: { taskId: taskA.id, durationSeconds: 600, startedAt: nowIso, clientRequestId: randomUUID() },
      });
      const wsA2 = await api("/api/work-sessions", {
        method: "POST",
        token: tempMemberA.token,
        body: { taskId: taskA.id, durationSeconds: 400, startedAt: nowIso, clientRequestId: randomUUID() },
      });
      const wsAProj = await api("/api/work-sessions", {
        method: "POST",
        token: tempMemberA.token,
        body: { projectId: standaloneProjId, durationSeconds: 400, startedAt: nowIso, clientRequestId: randomUUID() },
      });
      // tempMemberB logs 1000s, 500s, 300s on taskB
      const wsB1 = await api("/api/work-sessions", {
        method: "POST",
        token: tempMemberB.token,
        body: { taskId: taskB.id, durationSeconds: 1000, startedAt: nowIso, clientRequestId: randomUUID() },
      });
      const wsB2 = await api("/api/work-sessions", {
        method: "POST",
        token: tempMemberB.token,
        body: { taskId: taskB.id, durationSeconds: 500, startedAt: nowIso, clientRequestId: randomUUID() },
      });
      const wsB3 = await api("/api/work-sessions", {
        method: "POST",
        token: tempMemberB.token,
        body: { taskId: taskB.id, durationSeconds: 300, startedAt: nowIso, clientRequestId: randomUUID() },
      });

      assert(
        [wsA1, wsA2, wsAProj, wsB1, wsB2, wsB3].every((r) => r.status === 200 && r.json?.data?.id),
        "Failed logging work sessions"
      );
      wsA1Id = wsA1.json.data.id;
      wsA2Id = wsA2.json.data.id;
      wsAProjId = wsAProj.json.data.id;
      wsBApprovedId = wsB1.json.data.id;
      wsBPendingId = wsB2.json.data.id;
      wsBRejectedId = wsB3.json.data.id;

      // Re-activate sprint1 for leaderboard SPRINT period & dashboard checks
      const rReactivate = await api(`/api/sprints/${sprint1.id}/status`, {
        method: "PATCH",
        token: tempScrumAdmin.token,
        body: { status: "ACTIVE" },
      });
      assert(rReactivate.status === 200, "Failed reactivating sprint1");

      // Check work-targets recent includes both TASK and PROJECT kinds
      const wtRecent = await api("/api/work-targets/mine", { token: tempMemberA.token });
      assert(
        wtRecent.json.data.recent.some((r) => r.kind === "TASK" && r.id === taskA.id) &&
          wtRecent.json.data.recent.some((r) => r.kind === "PROJECT" && r.id === standaloneProjId),
        "Recent targets missing TASK or PROJECT"
      );
      return "Logged 6 sessions (including Task with 0 ACTIVE sprints)";
    });

    await runCheck("TaskModeration", "SCRUM_ADMIN moderates assigned Task (all 3 statuses); blocked on Project & unassigned Scrum", async () => {
      // SCRUM_ADMIN blocked from moderating Studio Project session
      const rForbProj = await api(`/api/work-sessions/${wsAProjId}/decision`, {
        method: "PATCH",
        token: tempScrumAdmin.token,
        body: { decision: "APPROVED" },
      });
      assert(rForbProj.status === 403, `SCRUM_ADMIN moderating Project expected 403, got ${rForbProj.status}`);

      // SCRUM_ADMIN blocked from moderating a Task session in an unassigned Scrum (seededScrum)
      const rSeededSess = await api(`/api/work-sessions?targetType=TASK&userId=${member1Auth.user.id}`, { token: saAuth.token });
      const seededTaskSessId = rSeededSess.json?.data?.sessions?.[0]?.id;
      assert(seededTaskSessId, "Missing seeded Task session for cross-scrum 403 check");
      const rForbCross = await api(`/api/work-sessions/${seededTaskSessId}/decision`, {
        method: "PATCH",
        token: tempScrumAdmin.token,
        body: { decision: "APPROVED" },
      });
      assert(rForbCross.status === 403, `SCRUM_ADMIN moderating unassigned Scrum task expected 403, got ${rForbCross.status}`);

      // Approve A's task sessions (1000s), approve B's 1000s, reject B's 300s (leaving B's 500s PENDING)
      for (const id of [wsA1Id, wsA2Id, wsBApprovedId]) {
        const rApp = await api(`/api/work-sessions/${id}/decision`, {
          method: "PATCH",
          token: tempScrumAdmin.token,
          body: { decision: "APPROVED" },
        });
        assert(rApp.status === 200 && !("role" in rApp.json.data.user), `Decision ${id} failed or leaked role`);
      }
      const rRej = await api(`/api/work-sessions/${wsBRejectedId}/decision`, {
        method: "PATCH",
        token: tempScrumAdmin.token,
        body: { decision: "REJECTED" },
      });
      assert(rRej.status === 200 && rRej.json.data.approval === "REJECTED", "Reject failed");

      // Admin approves studio project session
      const rProjApp = await api(`/api/work-sessions/${wsAProjId}/decision`, {
        method: "PATCH",
        token: adminAuth.token,
        body: { decision: "APPROVED" },
      });
      assert(rProjApp.status === 200 && rProjApp.json.data.approval === "APPROVED", "Admin project approve failed");
      return "All 3 statuses set + 403 isolation verified";
    });

    await runCheck("WorkLogView", "GET /tasks/:id/work-sessions & /projects/:id/work-sessions date/status filters & privacy", async () => {
      const { todayStr } = getTehranTodayAndWeekday();

      // Editor gets all 3 statuses on taskB
      const rTaskBEd = await api(
        `/api/tasks/${taskB.id}/work-sessions?dateFrom=${todayStr}&dateTo=${todayStr}&approval=ALL`,
        { token: tempScrumAdmin.token }
      );
      assert(rTaskBEd.status === 200, `TaskB view failed: ${rTaskBEd.status}`);
      const dB = rTaskBEd.json.data;
      assert(dB.target.kind === "TASK" && dB.permissions.canViewAllUsers === true && dB.permissions.canModerate === true, "Target/perms mismatch");
      assert(
        dB.summary.approvedSeconds === 1000 &&
          dB.summary.pendingSeconds === 500 &&
          dB.summary.rejectedSeconds === 300 &&
          dB.summary.totalSeconds === 1800,
        `Unexpected 3-status summary: ${JSON.stringify(dB.summary)}`
      );
      assert(dB.summary.byUser.length === 1 && dB.summary.byUser[0].user.id === tempMemberB.id, "byUser mismatch");
      assert(dB.sessions.length === 3, "Expected all 3 sessions in ALL filter");
      assert(findCodeKeys(rTaskBEd.json).length === 0, "Leaked code key");

      // Filter by approval=REJECTED
      const rRejOnly = await api(`/api/tasks/${taskB.id}/work-sessions?approval=REJECTED`, { token: tempScrumAdmin.token });
      assert(rRejOnly.status === 200 && rRejOnly.json.data.sessions.length === 1 && rRejOnly.json.data.sessions[0].approval === "REJECTED", "REJECTED filter mismatch");

      // Plain USER on taskB sees ONLY own sessions (0) & userId=<other> returns 403
      const rTaskBMemA = await api(`/api/tasks/${taskB.id}/work-sessions`, { token: tempMemberA.token });
      const rTaskBMemCross = await api(`/api/tasks/${taskB.id}/work-sessions?userId=${tempMemberB.id}`, { token: tempMemberA.token });
      assert(rTaskBMemA.status === 200 && rTaskBMemA.json.data.sessions.length === 0 && rTaskBMemA.json.data.permissions.canViewAllUsers === false, "Plain USER saw teammate data!");
      assert(rTaskBMemCross.status === 403, `Plain USER ?userId=other expected 403, got ${rTaskBMemCross.status}`);

      // Plain USER on taskA sees own 2 sessions ONLY (not Member B if Member B logged)
      const rTaskAMemA = await api(`/api/tasks/${taskA.id}/work-sessions`, { token: tempMemberA.token });
      assert(rTaskAMemA.status === 200 && rTaskAMemA.json.data.summary.approvedSeconds === 1000, "Member A own taskA view failed");

      // Studio Project view for ADMIN shows tempMemberA's 400s
      const rProjView = await api(`/api/projects/${standaloneProjId}/work-sessions?date=${todayStr}`, { token: adminAuth.token });
      assert(rProjView.status === 200 && rProjView.json.data.summary.approvedSeconds === 400 && rProjView.json.data.sessions.length === 1, "Project work-log view mismatch");
      return "3-status view + date/approval filters + USER privacy verified";
    });

    await runCheck("Report & Targets", "Scrum report (member privacy), /work-sessions/targets & Reports project/task filters", async () => {
      // Scrum report
      const rMemRep = await api(`/api/scrums/${tempScrumId}/report`, { token: tempMemberB.token });
      const rEdRep = await api(`/api/scrums/${tempScrumId}/report`, { token: tempScrumAdmin.token });
      assert(rMemRep.status === 200 && rEdRep.status === 200, "Scrum report failed");
      assert(rMemRep.json.data.rows.every((r) => !r.member || r.member.id === tempMemberB.id), "Member report leaked teammate rows");
      // Member B has 1000+500 = 1500s non-rejected on taskB (0 on taskA)
      assert(rMemRep.json.data.total.totalSeconds === 1500, `Member B report expected 1500s, got ${rMemRep.json.data.total.totalSeconds}`);
      // Editor sees 1000s (A on taskA) + 1500s (B on taskB) = 2500s; totalTasks=3 (A, B, Inactive), activeTasks=2
      assert(rEdRep.json.data.total.totalSeconds === 2500, `Editor report expected 2500s, got ${rEdRep.json.data.total.totalSeconds}`);
      assert(rEdRep.json.data.total.totalTasks === 3 && rEdRep.json.data.total.activeTasks === 2, "Unexpected report task totals");
      assert(rEdRep.json.data.sprints.some((sp) => sp.id === sprint1.id && sp.progressPercent === 60), "Missing sprint progressPercent in report");

      // Reports targets endpoint
      const rForbTargets = await api("/api/work-sessions/targets", { token: tempScrumAdmin.token });
      assert(rForbTargets.status === 403, `SCRUM_ADMIN /work-sessions/targets expected 403, got ${rForbTargets.status}`);

      const rTargets = await api("/api/work-sessions/targets", { token: adminAuth.token });
      assert(rTargets.status === 200, `/work-sessions/targets status=${rTargets.status}`);
      assert(rTargets.json.data.projects.some((p) => p.id === standaloneProjId), "Targets missing standaloneProjId");
      assert(rTargets.json.data.tasks.some((t) => t.id === taskA.id && t.scrumId === tempScrumId), "Targets missing taskA");

      // Performance report filters: targetType=TASK + taskId, targetType=PROJECT + projectId, and conflicting params -> 400
      const rTaskFilter = await api(`/api/work-sessions?targetType=TASK&taskId=${taskB.id}`, { token: adminAuth.token });
      assert(rTaskFilter.status === 200 && rTaskFilter.json.data.sessions.length === 3 && rTaskFilter.json.data.sessions.every((s) => s.targetType === "TASK"), "targetType=TASK filter failed");

      const rProjFilter = await api(`/api/work-sessions/summary?groupBy=project&targetType=PROJECT&projectId=${standaloneProjId}`, { token: adminAuth.token });
      assert(rProjFilter.status === 200 && rProjFilter.json.data.length === 1 && rProjFilter.json.data[0].targetType === "PROJECT", "Summary PROJECT filter failed");

      const rConflict1 = await api(`/api/work-sessions?targetType=PROJECT&taskId=${taskB.id}`, { token: adminAuth.token });
      const rConflict2 = await api(`/api/work-sessions/summary?projectId=${standaloneProjId}&taskId=${taskB.id}`, { token: adminAuth.token });
      assert(rConflict1.status === 400 && rConflict2.status === 400, `Expected 400 on conflicting filters, got ${rConflict1.status}/${rConflict2.status}`);
      return "Report + /targets + targetType filters verified";
    });

    await runCheck("Leaderboard", "APPROVED-only competition ties (1,1,3), REJECTED excluded, pendingSeconds in me ONLY", async () => {
      for (const period of ["SPRINT", "MONTH", "ALL"]) {
        const lbB = await api(`/api/scrums/${tempScrumId}/leaderboard?period=${period}`, { token: tempMemberB.token });
        assert(lbB.status === 200, `Leaderboard ${period} failed: ${lbB.status}`);
        const d = lbB.json.data;
        assert(d.period === period && d.rows.length === 3, `Unexpected ${period} rows`);
        assert(d.rows[0].approvedSeconds === 1000 && d.rows[0].rank === 1, `${period} rank 1 mismatch`);
        assert(d.rows[1].approvedSeconds === 1000 && d.rows[1].rank === 1, `${period} tie rank 1 mismatch`);
        assert(d.rows[2].approvedSeconds === 0 && d.rows[2].rank === 3, `${period} rank 3 mismatch`);
        assert(d.rows.every((r) => !("pendingSeconds" in r)), `${period} leaked pendingSeconds into rows`);
        // REJECTED 300s must NOT be in approvedSeconds OR pendingSeconds!
        assert(d.me.rank === 1 && d.me.approvedSeconds === 1000 && d.me.pendingSeconds === 500, `${period} B.me mismatch: ${JSON.stringify(d.me)}`);
        assert(findCodeKeys(lbB.json).length === 0, "Leaked code key");
      }

      const lbAdmin = await api(`/api/scrums/${tempScrumId}/leaderboard?period=SPRINT`, { token: tempScrumAdmin.token });
      assert(lbAdmin.status === 200 && lbAdmin.json.data.me.rank === null, "Non-member editor me.rank must be null");

      const lbSeeded = await api(`/api/scrums/${seededScrum.id}/leaderboard?period=ALL`, { token: member1Auth.token });
      assert(lbSeeded.status === 200 && lbSeeded.json.data.rows[0]?.approvedSeconds === 2700, `Expected IT1102 2700s at #1, got ${lbSeeded.json.data.rows[0]?.approvedSeconds}`);
      assert(lbSeeded.json.data.me.approvedSeconds === 1500 && lbSeeded.json.data.me.pendingSeconds > 0, "Seeded member1 me mismatch");
      return "Ranks 1,1,3 + REJECTED excluded + seeded verified";
    });

    await runCheck("Dashboard", "GET /api/scrum-admin/dashboard reports task counts, points & manual progressPercent", async () => {
      const rForbU = await api("/api/scrum-admin/dashboard", { token: tempMemberA.token });
      const rForbA = await api("/api/scrum-admin/dashboard", { token: adminAuth.token });
      assert(rForbU.status === 403 && rForbA.status === 403, "Expected 403 for USER/ADMIN");

      const rAdm = await api("/api/scrum-admin/dashboard", { token: tempScrumAdmin.token });
      assert(rAdm.status === 200, `Admin dashboard failed: ${rAdm.status}`);
      const d = rAdm.json.data;
      assert(d.totals.scrums === 1 && d.totals.members === 3 && d.totals.activeSprints === 1, `Unexpected totals: ${JSON.stringify(d.totals)}`);
      assert(d.totals.activeTasks === 2 && d.totals.totalTasks === 3 && d.totals.totalTaskPoints === 16, `Unexpected task totals: ${JSON.stringify(d.totals)}`);
      assert(d.scrums[0].taskCount === 3 && d.scrums[0].activeTaskCount === 2 && d.scrums[0].totalTaskPoints === 16, "Unexpected scrum task card stats");
      assert(d.scrums[0].activeSprint?.progressPercent === 60, `Expected progressPercent=60, got ${d.scrums[0].activeSprint?.progressPercent}`);
      assert(d.scrums[0].kpi.total === 2 && d.todayEvents.length === 2, "KPI/events count mismatch");

      const rSaDash = await api("/api/scrum-admin/dashboard", { token: saAuth.token });
      const sumCounts = rSaDash.json.data.scrums.reduce((acc, s) => acc + s.memberCount, 0);
      assert(rSaDash.json.data.totals.members < sumCounts, "Distinct member deduplication failed");
      assert(findCodeKeys(rSaDash.json).length === 0, "Leaked code key in dashboard");
      return `activeTasks=${d.totals.activeTasks}/${d.totals.totalTasks}, pts=${d.totals.totalTaskPoints}, progress=60%`;
    });

    // ---------------------------------------------------------
    // I. Delete Guards & Role/Active Cache Invalidation
    // ---------------------------------------------------------
    await runCheck("DeleteGuards", "409 deleting Task & Scrum with sessions; clean 200 deleting Sprint", async () => {
      const rTask409 = await api(`/api/tasks/${taskA.id}`, { method: "DELETE", token: tempScrumAdmin.token });
      const rScr409 = await api(`/api/scrums/${tempScrumId}`, { method: "DELETE", token: saAuth.token });
      const rSpr200 = await api(`/api/sprints/${sprint2.id}`, { method: "DELETE", token: tempScrumAdmin.token });
      assert(rTask409.status === 409 && rScr409.status === 409, `Expected 409/409, got ${rTask409.status}/${rScr409.status}`);
      assert(rSpr200.status === 200, `Simplified sprint DELETE expected 200, got ${rSpr200.status}`);
      return "Task/Scrum=409, Sprint=200";
    });

    await runCheck("CacheInvalidation", "Role change away from SCRUM_ADMIN & isActive=false clean up ScrumAdmin immediately", async () => {
      const rProm = await api(`/api/users/${tempMemberC.id}`, { method: "PATCH", token: saAuth.token, body: { role: "SCRUM_ADMIN" } });
      assert(rProm.status === 200, `Promote failed: ${rProm.status}`);

      const rDashProm = await api("/api/scrum-admin/dashboard", { token: tempMemberC.token });
      assert(rDashProm.status === 200, "Promoted user dashboard failed");

      await api(`/api/scrums/${tempScrum2Id}/admins`, { method: "PUT", token: saAuth.token, body: { userIds: [tempScrumAdmin2.id, tempMemberC.id] } });
      const rDemUser = await api(`/api/users/${tempMemberC.id}`, { method: "PATCH", token: saAuth.token, body: { role: "USER" } });
      assert(rDemUser.status === 200, "Demote failed");

      const rDashBlocked = await api("/api/scrum-admin/dashboard", { token: tempMemberC.token });
      const rScrum2Gone = await api(`/api/scrums/${tempScrum2Id}`, { token: tempMemberC.token });
      assert(rDashBlocked.status === 403 && rScrum2Gone.status === 404, "Immediate demotion/cache invalidation failed");

      await api(`/api/users/${tempScrumAdmin2.id}`, { method: "PATCH", token: saAuth.token, body: { isActive: false } });
      const rCheckAdmins = await api(`/api/scrums/${tempScrum2Id}`, { token: saAuth.token });
      assert(rCheckAdmins.status === 200 && rCheckAdmins.json.data.admins.length === 0, "Deactivated admin still in ScrumAdmin");
      return "Cache invalidation + ScrumAdmin cleanup verified";
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
