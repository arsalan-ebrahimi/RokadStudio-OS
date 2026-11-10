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

    await runCheck("Swagger", "GET /api-docs.json has all Scrum, Project, Users & Dashboard docs", async () => {
      const res = await api("/api-docs.json");
      assert(res.status === 200 && res.json && typeof res.json === "object", `Status=${res.status}`);
      const doc = res.json;
      const requiredPaths = [
        "/api/users/scrum-admins",
        "/api/scrums",
        "/api/scrums/today-events",
        "/api/scrums/{id}",
        "/api/scrums/{id}/admins",
        "/api/scrums/{id}/members",
        "/api/scrums/{id}/projects",
        "/api/scrums/{id}/projects/available",
        "/api/scrums/{id}/projects/link",
        "/api/scrums/{id}/projects/{projectId}/link",
        "/api/scrums/{id}/projects/{projectId}/members",
        "/api/scrums/{id}/sprints",
        "/api/scrums/{id}/kpis",
        "/api/scrums/{id}/events",
        "/api/scrums/{id}/report",
        "/api/scrums/{id}/leaderboard",
        "/api/sprints/{id}",
        "/api/sprints/{id}/status",
        "/api/sprints/{id}/projects",
        "/api/sprint-projects/{id}",
        "/api/work-targets/mine",
        "/api/scrum-admin/dashboard",
      ];
      for (const p of requiredPaths) {
        assert(Boolean(doc.paths?.[p]), `Missing swagger path ${p}`);
      }
      const requiredSchemas = [
        "UserBasicItem",
        "ScrumBrief",
        "ScrumPermissions",
        "ScrumResponse",
        "SprintResponse",
        "SprintProjectItem",
        "ScrumLinkedProjectItem",
        "AvailableScrumProjectItem",
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
      assert(!doc.components.schemas.ScrumResponse.properties.ownerId, "ownerId still in ScrumResponse schema");
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

    await runCheck("Setup", "Create & login isolated temp users for write/project/leaderboard tests", async () => {
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

    await runCheck("ListFiltering", "SCRUM_ADMIN sees assigned scrum with myRole=ADMIN, admins[], permissions & no ownerId", async () => {
      const r = await api("/api/scrums", { token: scrumAdminAuth.token });
      assert(r.status === 200 && Array.isArray(r.json?.data), `Status=${r.status}`);
      seededScrum = r.json.data.find((s) =>
        Array.isArray(s.admins) && s.admins.some((a) => a.id === scrumAdminAuth.user.id)
      );
      assert(seededScrum, "Seeded scrum missing for SC1101");
      assert(!("ownerId" in seededScrum), "Legacy ownerId still present in Scrum item");
      assert(seededScrum.myRole === "ADMIN", `Expected myRole=ADMIN, got ${seededScrum.myRole}`);
      assert(seededScrum.canEdit === true, `Expected canEdit=true, got ${seededScrum.canEdit}`);
      assert(
        seededScrum.permissions?.canEditContent === true &&
          seededScrum.permissions?.canManageAdmins === false &&
          seededScrum.permissions?.canArchive === false,
        `Unexpected permissions: ${JSON.stringify(seededScrum.permissions)}`
      );
      assert(seededScrum.admins.length >= 2, "Expected 2 seeded admins on seededScrum");
      assert(seededScrum.activeSprint?.number === 1, "Expected seeded activeSprint #1");
      assert(findCodeKeys(r.json).length === 0, "Leaked code key");
      return `scrumId=${seededScrum.id}, admins=${seededScrum.admins.length}`;
    });

    await runCheck("ListFiltering", "SC1102 sees both assigned scrums; IT1101 sees member scrum with myRole=MEMBER", async () => {
      const rSc2 = await api("/api/scrums", { token: scrumAdmin2Auth.token });
      assert(rSc2.status === 200 && rSc2.json.data.length >= 2, "SC1102 should see >= 2 scrums");

      const rMem = await api("/api/scrums", { token: member1Auth.token });
      assert(rMem.status === 200 && Array.isArray(rMem.json?.data), `Status=${rMem.status}`);
      const item = rMem.json.data.find((s) => s.id === seededScrum.id);
      assert(item && item.myRole === "MEMBER" && item.canEdit === false, "IT1101 myRole/canEdit mismatch");
      assert(findCodeKeys(rMem.json).length === 0, "Leaked code key");
      return `SC1102=${rSc2.json.data.length}, IT1101=${rMem.json.data.length}`;
    });

    await runCheck("ListFiltering", "Outsider (IT1103) & unassigned SCRUM_ADMIN do not see seeded scrums; SA sees SUPER_ADMIN role", async () => {
      const rOut = await api("/api/scrums", { token: outsiderAuth.token });
      const rTemp = await api("/api/scrums", { token: tempScrumAdmin.token });
      assert(rOut.status === 200 && rOut.json.data.length === 0, "Outsider saw a scrum");
      assert(rTemp.status === 200 && rTemp.json.data.length === 0, "Unassigned SCRUM_ADMIN saw a scrum");

      const rSa = await api("/api/scrums", { token: saAuth.token });
      assert(rSa.status === 200 && rSa.json.data.some((s) => s.id === seededScrum.id), "SA missing scrum");
      assert(
        rSa.json.data.every(
          (s) =>
            s.myRole === "SUPER_ADMIN" &&
            s.permissions?.canEditContent === true &&
            s.permissions?.canManageAdmins === true &&
            s.permissions?.canArchive === true
        ),
        "Expected SA SUPER_ADMIN permissions on all"
      );

      // SCRUM_ADMIN /api/users/search returns only { id, name } without role or code
      const searchRes = await api("/api/users/search?q=Artin", { token: scrumAdminAuth.token });
      assert(searchRes.status === 200 && searchRes.json.data.length > 0, `Search status=${searchRes.status}`);
      assert(!("role" in searchRes.json.data[0]), "Leaked role to SCRUM_ADMIN in /api/users/search");
      assert(findCodeKeys(searchRes.json).length === 0, "Leaked code key in /api/users/search");
      return "Visibility & /users/search privacy verified";
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
      assert(typeof ownerRow.target === "number" && typeof ownerRow.minExpected === "number", "Decimal not numeric");
      assert(ownerRow.progressPercent === 94.12 && ownerRow.status === "IN_RANGE", "KPI computation mismatch");
      assert(sRes.json.data[0].minExpected === ownerRow.minExpected, "SA minExpected mismatch");
      seededKpiList = oRes.json.data;
      return `progress=${ownerRow.progressPercent}, status=${ownerRow.status}`;
    });

    // ---------------------------------------------------------
    // C. New Permission Model (SA-only Create/Admins/Archive/Delete + SCRUM_ADMIN Union)
    // ---------------------------------------------------------
    await runCheck("PermissionModel", "Only SUPER_ADMIN can create scrums; SCRUM_ADMIN/USER/ADMIN get 403; invalid adminIds -> 422", async () => {
      const rUser = await api("/api/scrums", {
        method: "POST",
        token: tempMemberA.token,
        body: { name: "Unauthorized" },
      });
      const rSaBlocked = await api("/api/scrums", {
        method: "POST",
        token: tempScrumAdmin.token,
        body: { name: "ScrumAdmin Cannot Create" },
      });
      const rAdmin = await api("/api/scrums", {
        method: "POST",
        token: adminAuth.token,
        body: { name: "Admin Cannot Create" },
      });
      const rBadAdminRole = await api("/api/scrums", {
        method: "POST",
        token: saAuth.token,
        body: { name: "Bad Admin", adminIds: [tempMemberA.id] },
      });
      assert(rUser.status === 403, `USER expected 403, got ${rUser.status}`);
      assert(rSaBlocked.status === 403, `SCRUM_ADMIN create expected 403, got ${rSaBlocked.status}`);
      assert(rAdmin.status === 403, `ADMIN expected 403, got ${rAdmin.status}`);
      assert(rBadAdminRole.status === 422, `Invalid adminIds role expected 422, got ${rBadAdminRole.status}`);
      return "403 / 403 / 403 / 422";
    });

    await runCheck("ScrumCRUD", "SUPER_ADMIN creates tempScrum (with tempScrumAdmin) & tempScrum2 (union visibility test)", async () => {
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
      assert(r1.status === 201 && r1.json?.data?.id, `Create 1 failed: ${r1.status} ${r1.json?.message}`);
      const d = r1.json.data;
      tempScrumId = d.id;
      createdScrumIds.push(tempScrumId);
      assert(!("ownerId" in d), "Legacy ownerId leaked");
      assert(d.admins.length === 1 && d.admins[0].id === tempScrumAdmin.id, "Admin mismatch");
      assert(d.memberCount === 0 && d.members.length === 0, "Expected 0 auto-added members");
      assert(d.myRole === "SUPER_ADMIN", "Expected SA myRole=SUPER_ADMIN");
      assert(d.permissions?.canEditContent && d.permissions?.canManageAdmins && d.permissions?.canArchive, "Expected full SA perms");
      assert(findCodeKeys(r1.json).length === 0, "Leaked code key");

      // Create second scrum assigned ONLY to tempScrumAdmin2; add tempScrumAdmin as plain MEMBER for union visibility test
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

      const rMem2 = await api(`/api/scrums/${tempScrum2Id}/members`, {
        method: "PUT",
        token: tempScrumAdmin2.token,
        body: {
          members: [
            { userId: tempScrumAdmin.id, label: "عضو ناظر" },
            { userId: tempMemberA.id, label: "عضو مشترک" },
          ],
        },
      });
      assert(rMem2.status === 200, "Failed setting members on tempScrum2");

      // Union visibility check for tempScrumAdmin: sees Scrum1 (ADMIN) and Scrum2 (MEMBER)
      const rList = await api("/api/scrums", { token: tempScrumAdmin.token });
      const ids = rList.json.data.map((x) => x.id);
      assert(new Set(ids).size === ids.length, "Duplicate scrums in SCRUM_ADMIN union");
      const s1 = rList.json.data.find((x) => x.id === tempScrumId);
      const s2 = rList.json.data.find((x) => x.id === tempScrum2Id);
      assert(s1 && s1.myRole === "ADMIN" && s1.canEdit === true, "Union: Scrum1 should be ADMIN");
      assert(s2 && s2.myRole === "MEMBER" && s2.canEdit === false, "Union: Scrum2 should be MEMBER");
      assert(s2.permissions.canEditContent === false && !s2.permissions.canArchive, "Expected false perms on Scrum2");

      // Also verify SC1101 (both admin & member of seededScrum) gets 1 de-duplicated entry with myRole=ADMIN & GET /scrums/:id fields
      const rSc1List = await api("/api/scrums", { token: scrumAdminAuth.token });
      const sc1Ids = rSc1List.json.data.map((x) => x.id);
      assert(new Set(sc1Ids).size === sc1Ids.length, "Duplicate scrum for SC1101 (admin+member)");
      const rDetail = await api(`/api/scrums/${tempScrumId}`, { token: tempScrumAdmin.token });
      assert(
        rDetail.status === 200 &&
          Array.isArray(rDetail.json.data.admins) &&
          rDetail.json.data.myRole === "ADMIN" &&
          rDetail.json.data.permissions?.canEditContent === true,
        "GET /scrums/:id missing admins/myRole/permissions"
      );
      return `scrum1=${tempScrumId}(ADMIN), scrum2=${tempScrum2Id}(MEMBER)`;
    });

    await runCheck("PermissionModel", "PUT /admins Set Diffing, 403 for SCRUM_ADMIN, 403 for PATCH isActive & DELETE", async () => {
      const rAdminsForb = await api(`/api/scrums/${tempScrumId}/admins`, {
        method: "PUT",
        token: tempScrumAdmin.token,
        body: { userIds: [tempScrumAdmin.id] },
      });
      const rArchiveForb = await api(`/api/scrums/${tempScrumId}`, {
        method: "PATCH",
        token: tempScrumAdmin.token,
        body: { isActive: false },
      });
      const rDelForb = await api(`/api/scrums/${tempScrumId}`, {
        method: "DELETE",
        token: tempScrumAdmin.token,
      });
      const rAdminsBadRole = await api(`/api/scrums/${tempScrumId}/admins`, {
        method: "PUT",
        token: saAuth.token,
        body: { userIds: [tempMemberA.id] },
      });
      assert(rAdminsForb.status === 403, `SCRUM_ADMIN PUT /admins expected 403, got ${rAdminsForb.status}`);
      assert(rArchiveForb.status === 403, `SCRUM_ADMIN PATCH isActive expected 403, got ${rArchiveForb.status}`);
      assert(rDelForb.status === 403, `SCRUM_ADMIN DELETE expected 403, got ${rDelForb.status}`);
      assert(rAdminsBadRole.status === 422, `Bad role in PUT /admins expected 422, got ${rAdminsBadRole.status}`);

      // Add tempScrumAdmin2 temporarily, then revert back to [tempScrumAdmin]
      const rAdd = await api(`/api/scrums/${tempScrumId}/admins`, {
        method: "PUT",
        token: saAuth.token,
        body: { userIds: [tempScrumAdmin.id, tempScrumAdmin2.id] },
      });
      assert(rAdd.status === 200 && rAdd.json.data.length === 2, `Expected 2 admins, got ${rAdd.status}`);
      const rRevert = await api(`/api/scrums/${tempScrumId}/admins`, {
        method: "PUT",
        token: saAuth.token,
        body: { userIds: [tempScrumAdmin.id] },
      });
      assert(rRevert.status === 200 && rRevert.json.data.length === 1, "Revert admins failed");
      return "403s + 422 + Set Diffing verified";
    });

    await runCheck("AccessControl", "Sync members: valid add succeeds; duplicate / ADMIN member rejected (400)", async () => {
      const rDup = await api(`/api/scrums/${tempScrumId}/members`, {
        method: "PUT",
        token: tempScrumAdmin.token,
        body: {
          members: [
            { userId: tempMemberA.id, label: "Dup1" },
            { userId: tempMemberA.id, label: "Dup2" },
          ],
        },
      });
      const rAdminMem = await api(`/api/scrums/${tempScrumId}/members`, {
        method: "PUT",
        token: tempScrumAdmin.token,
        body: { members: [{ userId: adminAuth.user.id, label: "Admin" }] },
      });
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
      assert(rDup.status === 400, `Duplicate expected 400, got ${rDup.status}`);
      assert(rAdminMem.status === 400, `ADMIN member expected 400, got ${rAdminMem.status}`);
      assert(rOk.status === 200 && rOk.json.data.length === 3, `Sync expected 200/3, got ${rOk.status}`);
      assert(findCodeKeys(rOk.json).length === 0, "Leaked code key");
      return "Synced 3 members (excluding admin)";
    });

    await runCheck("IDOR", "Outsider (IT1103) & unassigned SCRUM_ADMIN (SC1101) get 404 across tempScrum endpoints", async () => {
      const checks = [
        ["GET", `/api/scrums/${tempScrumId}`, outsiderAuth.token],
        ["PATCH", `/api/scrums/${tempScrumId}`, outsiderAuth.token, { name: "x" }],
        ["DELETE", `/api/scrums/${tempScrumId}`, outsiderAuth.token],
        ["PUT", `/api/scrums/${tempScrumId}/admins`, outsiderAuth.token, { userIds: [] }],
        ["PUT", `/api/scrums/${tempScrumId}/members`, outsiderAuth.token, { members: [] }],
        ["GET", `/api/scrums/${tempScrumId}/projects`, outsiderAuth.token],
        ["GET", `/api/scrums/${tempScrumId}/projects/available`, outsiderAuth.token],
        ["GET", `/api/scrums/${tempScrumId}/sprints`, outsiderAuth.token],
        ["POST", `/api/scrums/${tempScrumId}/sprints`, outsiderAuth.token, {}],
        ["GET", `/api/scrums/${tempScrumId}/kpis`, outsiderAuth.token],
        ["PUT", `/api/scrums/${tempScrumId}/kpis`, outsiderAuth.token, { rows: [] }],
        ["GET", `/api/scrums/${tempScrumId}/events`, outsiderAuth.token],
        ["PUT", `/api/scrums/${tempScrumId}/events`, outsiderAuth.token, { rows: [] }],
        ["GET", `/api/scrums/${tempScrumId}/report`, outsiderAuth.token],
        ["GET", `/api/scrums/${tempScrumId}/leaderboard`, outsiderAuth.token],
        ["GET", `/api/scrums/${tempScrumId}`, scrumAdminAuth.token],
      ];
      for (const [m, p, tok, body] of checks) {
        const res = await api(p, { method: m, token: tok, body });
        assert(res.status === 404, `${m} ${p} expected 404, got ${res.status}`);
      }
      return `${checks.length} checks -> 404`;
    });

    await runCheck("RBAC", "Plain member & MEMBER-only SCRUM_ADMIN get 403 on scrum editor-only mutations", async () => {
      const checks = [
        ["PATCH", `/api/scrums/${tempScrumId}`, tempMemberA.token, { name: "Hack" }],
        ["PUT", `/api/scrums/${tempScrumId}/members`, tempMemberA.token, { members: [] }],
        ["GET", `/api/scrums/${tempScrumId}/projects/available`, tempMemberA.token],
        ["POST", `/api/scrums/${tempScrumId}/projects`, tempMemberA.token, { name: "Nope" }],
        ["POST", `/api/scrums/${tempScrumId}/sprints`, tempMemberA.token, {}],
        ["PUT", `/api/scrums/${tempScrumId}/kpis`, tempMemberA.token, { rows: [] }],
        ["PUT", `/api/scrums/${tempScrumId}/events`, tempMemberA.token, { rows: [] }],
        ["PATCH", `/api/scrums/${tempScrum2Id}`, tempScrumAdmin.token, { name: "Not Admin Here" }],
      ];
      for (const [m, p, tok, body] of checks) {
        const res = await api(p, { method: m, token: tok, body });
        assert(res.status === 403, `${m} ${p} expected 403, got ${res.status}`);
      }
      return `${checks.length} checks -> 403`;
    });

    await runCheck("ScrumCRUD", "Assigned SCRUM_ADMIN PATCHes metadata cleanly & empty PATCH returns 400", async () => {
      const rEmpty = await api(`/api/scrums/${tempScrumId}`, {
        method: "PATCH",
        token: tempScrumAdmin.token,
        body: {},
      });
      const rClear = await api(`/api/scrums/${tempScrumId}`, {
        method: "PATCH",
        token: tempScrumAdmin.token,
        body: { description: null },
      });
      assert(rEmpty.status === 400, `Empty PATCH expected 400, got ${rEmpty.status}`);
      assert(rClear.status === 200 && rClear.json.data.description === null, `Clear failed: ${rClear.status}`);
      return "Cleared description to null";
    });

    // ---------------------------------------------------------
    // D. KPI & Events Batch Update + Today Events + Archive (SA only)
    // ---------------------------------------------------------
    await runCheck("KPI", "Batch update KPIs (statuses, foreign id 400, dup id 400, member secrecy)", async () => {
      const rows = [
        { indicator: "Below Min", target: 100, minExpected: 50, actualValue: 30 },
        { indicator: "On Target", target: 100, minExpected: 50, actualValue: 100 },
      ];
      const rPut = await api(`/api/scrums/${tempScrumId}/kpis`, {
        method: "PUT",
        token: tempScrumAdmin.token,
        body: { rows },
      });
      assert(rPut.status === 200 && rPut.json.data.length === 2, `KPI PUT failed: ${rPut.status}`);
      assert(rPut.json.data[0].status === "BELOW_MIN", `Expected BELOW_MIN, got ${rPut.json.data[0].status}`);
      assert(rPut.json.data[1].status === "ON_TARGET", `Expected ON_TARGET, got ${rPut.json.data[1].status}`);

      const rRound = await api(`/api/scrums/${tempScrumId}/kpis`, {
        method: "PUT",
        token: tempScrumAdmin.token,
        body: { rows: rPut.json.data },
      });
      assert(rRound.status === 200 && rRound.json.data.length === 2, `KPI round-trip failed: ${rRound.status}`);

      if (seededKpiList.length > 0) {
        const rForeign = await api(`/api/scrums/${tempScrumId}/kpis`, {
          method: "PUT",
          token: tempScrumAdmin.token,
          body: { rows: [{ id: seededKpiList[0].id, indicator: "Cross", target: 10 }] },
        });
        assert(rForeign.status === 400, `Foreign KPI id expected 400, got ${rForeign.status}`);
      }

      const dupId = rPut.json.data[0].id;
      const rDup = await api(`/api/scrums/${tempScrumId}/kpis`, {
        method: "PUT",
        token: tempScrumAdmin.token,
        body: {
          rows: [
            { id: dupId, indicator: "A" },
            { id: dupId, indicator: "B" },
          ],
        },
      });
      assert(rDup.status === 400, `Duplicate KPI id expected 400, got ${rDup.status}`);

      const rMem = await api(`/api/scrums/${tempScrumId}/kpis`, { token: tempMemberA.token });
      assert(rMem.status === 200 && rMem.json.data.every((k) => !("minExpected" in k)), "minExpected leaked");
      return "2 KPI rows verified";
    });

    await runCheck("Events", "Batch events, Tehran /today-events & SA-only archive filter", async () => {
      const { todayStr, persianDayOfWeek } = getTehranTodayAndWeekday();
      const otherDay = (persianDayOfWeek + 1) % 7;

      const rBadOnce = await api(`/api/scrums/${tempScrumId}/events`, {
        method: "PUT",
        token: tempScrumAdmin.token,
        body: { rows: [{ name: "Bad Once", scheduleType: "ONCE", date: "bad-date" }] },
      });
      assert(rBadOnce.status === 400, `Invalid ONCE date expected 400, got ${rBadOnce.status}`);

      const rPut = await api(`/api/scrums/${tempScrumId}/events`, {
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
      assert(rPut.status === 200 && rPut.json.data.length === 3, `Events PUT failed: ${rPut.status}`);
      assert(isIsoDateOnly(rPut.json.data[1].date) && rPut.json.data[1].date === todayStr, "Expected YYYY-MM-DD");

      const rToday = await api("/api/scrums/today-events", { token: tempMemberA.token });
      assert(rToday.status === 200 && Array.isArray(rToday.json.data), `today-events status=${rToday.status}`);
      const ownToday = rToday.json.data.filter((e) => e.scrumId === tempScrumId);
      assert(ownToday.length === 2, `Expected 2 today events for tempScrum, got ${ownToday.length}`);

      // SUPER_ADMIN archives -> excluded from today-events -> SUPER_ADMIN unarchives
      const rArch = await api(`/api/scrums/${tempScrumId}`, {
        method: "PATCH",
        token: saAuth.token,
        body: { isActive: false },
      });
      assert(rArch.status === 200 && rArch.json.data.isActive === false, "SA archive failed");

      const rTodayArchived = await api("/api/scrums/today-events", { token: tempMemberA.token });
      assert(
        rTodayArchived.status === 200 && !rTodayArchived.json.data.some((e) => e.scrumId === tempScrumId),
        "Archived scrum events still returned"
      );

      await api(`/api/scrums/${tempScrumId}`, {
        method: "PATCH",
        token: saAuth.token,
        body: { isActive: true },
      });
      return `today=${todayStr}, dow=${persianDayOfWeek}`;
    });

    // ---------------------------------------------------------
    // E. Project <-> Scrum Linking & Project Endpoints
    // ---------------------------------------------------------
    let scrumLinkedProjId = null;
    let standaloneProjId = null;
    let otherScrumProjId = null;

    await runCheck("ProjectLink", "Scrum project CRUD, /available, /link (409 conflict), non-scrum ProjectMember preservation", async () => {
      // Create an unlinked studio project via SUPER_ADMIN (includes outsiderAuth as a non-scrum ProjectMember)
      const rStand = await api("/api/projects", {
        method: "POST",
        token: saAuth.token,
        body: {
          name: "Smoke Standalone Studio Project",
          description: "For link/unlink test",
          memberIds: [tempMemberA.id, outsiderAuth.user.id],
        },
      });
      assert(rStand.status === 201 && rStand.json.data.scrumId === null, `Create standalone failed: ${rStand.status}`);
      assert(rStand.json.data.scrum === null, "Expected scrum=null");
      standaloneProjId = rStand.json.data.id;
      createdProjectIds.push(standaloneProjId);

      // Inactive or non-existent scrumId on POST /api/projects
      const rBadProjScrum = await api("/api/projects", {
        method: "POST",
        token: saAuth.token,
        body: { name: "Bad Scrum Link", scrumId: 999999 },
      });
      assert(rBadProjScrum.status === 404, `Missing scrumId expected 404, got ${rBadProjScrum.status}`);

      // SCRUM_ADMIN cannot call POST/PATCH /api/projects directly (403)
      const rScrumAdminProj = await api("/api/projects", {
        method: "POST",
        token: tempScrumAdmin.token,
        body: { name: "Blocked" },
      });
      assert(rScrumAdminProj.status === 403, `SCRUM_ADMIN POST /api/projects expected 403, got ${rScrumAdminProj.status}`);

      // Create another project linked directly via POST /api/projects { scrumId: tempScrum2Id }
      const rProj2 = await api("/api/projects", {
        method: "POST",
        token: saAuth.token,
        body: {
          name: "Smoke Scrum2 Project",
          scrumId: tempScrum2Id,
          memberIds: [tempMemberA.id],
        },
      });
      assert(rProj2.status === 201 && rProj2.json.data.scrum?.id === tempScrum2Id, "Direct scrumId attach failed");
      otherScrumProjId = rProj2.json.data.id;
      createdProjectIds.push(otherScrumProjId);

      // Verify GET /api/projects & GET /api/projects/:id return scrum metadata
      const rListProj = await api("/api/projects?search=Smoke", { token: saAuth.token });
      const listedProj2 = rListProj.json.data.find((p) => p.id === otherScrumProjId);
      assert(listedProj2 && listedProj2.scrumId === tempScrum2Id && listedProj2.scrum?.name, "GET /api/projects missing scrum metadata");
      const rGetProj2 = await api(`/api/projects/${otherScrumProjId}`, { token: saAuth.token });
      assert(rGetProj2.status === 200 && rGetProj2.json.data.scrumId === tempScrum2Id && rGetProj2.json.data.scrum?.color === "CLUB", "GET /projects/:id missing scrum");

      // Scrum-side available projects lists standaloneProjId, excludes otherScrumProjId
      const rAvail = await api(`/api/scrums/${tempScrumId}/projects/available?q=Smoke`, {
        token: tempScrumAdmin.token,
      });
      assert(rAvail.status === 200, `Available failed: ${rAvail.status}`);
      assert(rAvail.json.data.some((p) => p.id === standaloneProjId), "Standalone missing in available");
      assert(!rAvail.json.data.some((p) => p.id === otherScrumProjId), "Already-linked project leaked in available");

      // Link standaloneProjId to tempScrumId -> 200; linking otherScrumProjId -> 409
      const rLink = await api(`/api/scrums/${tempScrumId}/projects/link`, {
        method: "POST",
        token: tempScrumAdmin.token,
        body: { projectId: standaloneProjId },
      });
      const rConflict = await api(`/api/scrums/${tempScrumId}/projects/link`, {
        method: "POST",
        token: tempScrumAdmin.token,
        body: { projectId: otherScrumProjId },
      });
      assert(rLink.status === 200 && rLink.json.data.id === standaloneProjId, `Link failed: ${rLink.status}`);
      assert(rConflict.status === 409, `Already-linked expected 409, got ${rConflict.status}`);

      // PUT /scrums/:id/projects/:projectId/members: non-scrum member rejected (422), valid sync preserves outsiderAuth!
      const rNonScrumMem = await api(`/api/scrums/${tempScrumId}/projects/${standaloneProjId}/members`, {
        method: "PUT",
        token: tempScrumAdmin.token,
        body: { userIds: [outsiderAuth.user.id] },
      });
      assert(rNonScrumMem.status === 422, `Non-scrum member expected 422, got ${rNonScrumMem.status}`);

      const rSyncProjMem = await api(`/api/scrums/${tempScrumId}/projects/${standaloneProjId}/members`, {
        method: "PUT",
        token: tempScrumAdmin.token,
        body: { userIds: [tempMemberA.id, tempMemberB.id] },
      });
      assert(rSyncProjMem.status === 200, `Sync proj members failed: ${rSyncProjMem.status}`);
      assert(
        rSyncProjMem.json.data.some((m) => m.id === outsiderAuth.user.id) &&
          rSyncProjMem.json.data.some((m) => m.id === tempMemberB.id),
        "Non-scrum ProjectMember was removed during Scrum member sync!"
      );

      // Verify removing tempMemberB removes ONLY the omitted scrum member while STILL preserving non-scrum outsiderAuth, then restore tempMemberA
      const rRemoveOnlyB = await api(`/api/scrums/${tempScrumId}/projects/${standaloneProjId}/members`, {
        method: "PUT",
        token: tempScrumAdmin.token,
        body: { userIds: [tempMemberA.id] },
      });
      assert(
        rRemoveOnlyB.status === 200 &&
          !rRemoveOnlyB.json.data.some((m) => m.id === tempMemberB.id) &&
          rRemoveOnlyB.json.data.some((m) => m.id === outsiderAuth.user.id),
        "Expected scrum member removal while preserving non-scrum ProjectMember"
      );

      // POST /scrums/:id/projects creates a new linked project inside tempScrumId
      const rBadScrumCreateMem = await api(`/api/scrums/${tempScrumId}/projects`, {
        method: "POST",
        token: tempScrumAdmin.token,
        body: { name: "Invalid Member", memberIds: [outsiderAuth.user.id] },
      });
      assert(rBadScrumCreateMem.status === 422, `Expected 422, got ${rBadScrumCreateMem.status}`);

      const rScrumCreateProj = await api(`/api/scrums/${tempScrumId}/projects`, {
        method: "POST",
        token: tempScrumAdmin.token,
        body: {
          name: "Smoke Scrum Internal Project",
          description: "Created via scrum",
          memberIds: [tempMemberA.id],
        },
      });
      assert(rScrumCreateProj.status === 201 && rScrumCreateProj.json.data.id, `Scrum create project failed: ${rScrumCreateProj.status}`);
      scrumLinkedProjId = rScrumCreateProj.json.data.id;
      createdProjectIds.push(scrumLinkedProjId);

      // GET /scrums/:id/projects includes trackedSeconds ONLY for editor, NOT plain member
      const rEdList = await api(`/api/scrums/${tempScrumId}/projects`, { token: tempScrumAdmin.token });
      const rMemList = await api(`/api/scrums/${tempScrumId}/projects`, { token: tempMemberA.token });
      assert(rEdList.status === 200 && rEdList.json.data.length === 2, "Expected 2 linked projects");
      assert("trackedSeconds" in rEdList.json.data[0], "Editor missing trackedSeconds");
      assert(!("trackedSeconds" in rMemList.json.data[0]), "Member must NOT receive trackedSeconds");
      return `linked=[${standaloneProjId},${scrumLinkedProjId}]`;
    });

    // ---------------------------------------------------------
    // F. WorkTargets when Scrum has NO active sprint + Sprint Concurrency
    // ---------------------------------------------------------
    await runCheck("WorkTargets", "Linked project appears in scrums[].projects even when sprint=null & leaves studioProjects", async () => {
      const wtBefore = await api("/api/work-targets/mine", { token: tempMemberA.token });
      assert(wtBefore.status === 200, `wtBefore failed: ${wtBefore.status}`);
      const grp = wtBefore.json.data.scrums.find((g) => g.scrum.id === tempScrumId);
      assert(grp && grp.sprint === null && grp.items.length === 0, "Expected scrum group with sprint=null");
      assert(grp.projects.some((p) => p.id === standaloneProjId) && grp.projects.some((p) => p.id === scrumLinkedProjId), "Linked projects missing in scrums[].projects");
      assert(
        !wtBefore.json.data.studioProjects.some((p) => p.id === standaloneProjId || p.id === scrumLinkedProjId),
        "Active scrum linked project must be excluded from studioProjects"
      );

      // Outsider (not ScrumMember of tempScrumId, only ProjectMember of standaloneProjId) still sees it in studioProjects!
      const wtOut = await api("/api/work-targets/mine", { token: outsiderAuth.token });
      assert(
        wtOut.json.data.studioProjects.some((p) => p.id === standaloneProjId),
        "Non-scrum ProjectMember must still see project in studioProjects"
      );
      return "scrums[].projects (sprint=null) + studioProjects exclusion verified";
    });

    let sprint1 = null;
    let sprint2 = null;
    let sprint3 = null;

    await runCheck("Sprints", "Concurrent POST /sprints (1,2,3) & single ACTIVE guard (200 + 409)", async () => {
      const responses = await Promise.all([
        api(`/api/scrums/${tempScrumId}/sprints`, { method: "POST", token: tempScrumAdmin.token, body: {} }),
        api(`/api/scrums/${tempScrumId}/sprints`, { method: "POST", token: tempScrumAdmin.token, body: {} }),
        api(`/api/scrums/${tempScrumId}/sprints`, { method: "POST", token: tempScrumAdmin.token, body: {} }),
      ]);
      for (const r of responses) {
        assert(r.status === 201 && r.json?.data?.id, `Concurrent create status=${r.status}`);
      }
      const sprintsList = await api(`/api/scrums/${tempScrumId}/sprints`, { token: tempScrumAdmin.token });
      const numbers = sprintsList.json.data.map((s) => s.number);
      assert(JSON.stringify(numbers) === JSON.stringify([1, 2, 3]), `Expected [1,2,3], got ${JSON.stringify(numbers)}`);
      [sprint1, sprint2, sprint3] = sprintsList.json.data;

      const [a1, a2] = await Promise.all([
        api(`/api/sprints/${sprint1.id}/status`, { method: "PATCH", token: tempScrumAdmin.token, body: { status: "ACTIVE" } }),
        api(`/api/sprints/${sprint2.id}/status`, { method: "PATCH", token: tempScrumAdmin.token, body: { status: "ACTIVE" } }),
      ]);
      const statuses = [a1.status, a2.status].sort((x, y) => x - y);
      assert(statuses[0] === 200 && statuses[1] === 409, `Expected [200, 409], got [${statuses.join(",")}]`);
      sprint1 = a1.status === 200 ? a1.json.data : a2.json.data;
      sprint2 = sprintsList.json.data.find((s) => s.id !== sprint1.id && s.id !== sprint3.id);
      assert(sprint2, "Failed locating sprint2");

      // Set today as startDate/endDate range on sprint1 so SPRINT leaderboard range covers today's sessions!
      const { todayStr } = getTehranTodayAndWeekday();
      const rDate = await api(`/api/sprints/${sprint1.id}`, {
        method: "PATCH",
        token: tempScrumAdmin.token,
        body: { startDate: todayStr, endDate: todayStr },
      });
      assert(rDate.status === 200 && rDate.json.data.startDate === todayStr, "Sprint date update failed");
      return `activeSprintId=${sprint1.id}`;
    });

    // ---------------------------------------------------------
    // G. Sprint Items + projectId Link Validation
    // ---------------------------------------------------------
    let itemA = null;
    let itemB = null;
    let itemSpare = null;

    await runCheck("SprintItems", "Create items with projectId (422 cross-scrum), member status-only & 403/404 guards", async () => {
      const rCrossProj = await api(`/api/sprints/${sprint1.id}/projects`, {
        method: "POST",
        token: tempScrumAdmin.token,
        body: { name: "Cross Scrum Project", points: 3, projectId: otherScrumProjId },
      });
      assert(rCrossProj.status === 422, `Cross-scrum projectId expected 422, got ${rCrossProj.status}`);

      const rA = await api(`/api/sprints/${sprint1.id}/projects`, {
        method: "POST",
        token: tempScrumAdmin.token,
        body: { name: "Item Alpha", points: 5, assigneeId: tempMemberA.id, projectId: standaloneProjId },
      });
      const rB = await api(`/api/sprints/${sprint1.id}/projects`, {
        method: "POST",
        token: tempScrumAdmin.token,
        body: { name: "Item Beta", points: 8, assigneeId: tempMemberB.id },
      });
      const rS = await api(`/api/sprints/${sprint2.id}/projects`, {
        method: "POST",
        token: tempScrumAdmin.token,
        body: { name: "Item Spare", points: 2, assigneeId: tempMemberA.id },
      });
      assert(rA.status === 201 && rB.status === 201 && rS.status === 201, "Item create failed");
      itemA = rA.json.data;
      itemB = rB.json.data;
      itemSpare = rS.json.data;
      assert(itemA.projectId === standaloneProjId && itemA.project?.name, "Expected project summary on SprintProjectItem");

      // Assignee status-only PATCH -> 200; extra field -> 403
      const rPatchOk = await api(`/api/sprint-projects/${itemA.id}`, {
        method: "PATCH",
        token: tempMemberA.token,
        body: { status: "DOING" },
      });
      const rPatchExtra = await api(`/api/sprint-projects/${itemA.id}`, {
        method: "PATCH",
        token: tempMemberA.token,
        body: { status: "DONE", projectId: scrumLinkedProjId },
      });
      assert(rPatchOk.status === 200 && rPatchOk.json.data.status === "DOING", "Assignee status failed");
      assert(rPatchExtra.status === 403, `Assignee extra field expected 403, got ${rPatchExtra.status}`);
      return `items=${itemA.id}(proj=${standaloneProjId}),${itemB.id},${itemSpare.id}`;
    });

    // ---------------------------------------------------------
    // H. Sessions, Report (SPRINT_ITEM + PROJECT), Leaderboard (SPRINT/MONTH/ALL + ties + privacy) & Dashboard
    // ---------------------------------------------------------
    let attAId = null;
    let attBId = null;
    let attCId = null;

    await runCheck("WorkSession", "Log sessions on SprintItem & linked Project + Verify Report & Privacy", async () => {
      const attA = await api("/api/attendance/today", { method: "POST", token: tempMemberA.token, body: { status: "PRESENT" } });
      const attB = await api("/api/attendance/today", { method: "POST", token: tempMemberB.token, body: { status: "PRESENT" } });
      const attC = await api("/api/attendance/today", { method: "POST", token: tempMemberC.token, body: { status: "PRESENT" } });
      assert(attA.json?.data?.id && attB.json?.data?.id && attC.json?.data?.id, "Attendance creation failed");
      attAId = attA.json.data.id;
      attBId = attB.json.data.id;
      attCId = attC.json.data.id;

      // Approve attendance B right away? Wait: let's keep all pending until we check 409 delete guard & report, then approve/verify leaderboard!
      const nowIso = new Date().toISOString();
      const wsAItem = await api("/api/work-sessions", {
        method: "POST",
        token: tempMemberA.token,
        body: { sprintProjectId: itemA.id, durationSeconds: 600, startedAt: nowIso, clientRequestId: randomUUID() },
      });
      const wsAProj = await api("/api/work-sessions", {
        method: "POST",
        token: tempMemberA.token,
        body: { projectId: standaloneProjId, durationSeconds: 400, startedAt: nowIso, clientRequestId: randomUUID() },
      });
      const wsBItem = await api("/api/work-sessions", {
        method: "POST",
        token: tempMemberB.token,
        body: { sprintProjectId: itemB.id, durationSeconds: 1000, startedAt: nowIso, clientRequestId: randomUUID() },
      });
      const wsBPendingExtra = await api("/api/work-sessions", {
        method: "POST",
        token: tempMemberB.token,
        body: { sprintProjectId: itemB.id, durationSeconds: 500, startedAt: nowIso, clientRequestId: randomUUID() },
      });
      assert(
        wsAItem.status === 200 && wsAProj.status === 200 && wsBItem.status === 200 && wsBPendingExtra.status === 200,
        "WorkSession creation failed"
      );

      // Report checks: SPRINT_ITEM + PROJECT rows, member privacy on BOTH!
      const memReport = await api(`/api/scrums/${tempScrumId}/report`, { token: tempMemberA.token });
      const edReport = await api(`/api/scrums/${tempScrumId}/report`, { token: tempScrumAdmin.token });
      assert(memReport.status === 200 && edReport.status === 200, "Report fetch failed");
      assert(memReport.json.data.rows.every((r) => r.member?.id === tempMemberA.id), "Member report leaked teammate rows");
      assert(memReport.json.data.total.totalSeconds === 1000, `Member report expected 1000s, got ${memReport.json.data.total.totalSeconds}`);
      assert(memReport.json.data.rows.some((r) => r.kind === "PROJECT" && r.project?.id === standaloneProjId && r.item === null), "Missing PROJECT row in report");
      assert(edReport.json.data.total.totalSeconds === 2500, `Editor report expected 2500s, got ${edReport.json.data.total.totalSeconds}`);
      assert(findCodeKeys(edReport.json).length === 0, "Leaked code key in report");

      // WorkTargets recent includes linked project
      const wtA = await api("/api/work-targets/mine", { token: tempMemberA.token });
      assert(wtA.json.data.recent.some((r) => r.kind === "STUDIO" && r.id === standaloneProjId), "Linked project missing from recent");
      return "SprintItem + LinkedProject report (1000s vs 2500s) verified";
    });

    await runCheck("Leaderboard", "APPROVED-only aggregation, competition ties (1,1,3), pendingSeconds ONLY in me, me.rank=null for non-member", async () => {
      // Before approving sessions: all 3 members have 0 approvedSeconds, ties at rank 1; Member B has pendingSeconds=1500 ONLY in me!
      const lbBeforeB = await api(`/api/scrums/${tempScrumId}/leaderboard?period=SPRINT`, { token: tempMemberB.token });
      assert(lbBeforeB.status === 200, `Leaderboard failed: ${lbBeforeB.status}`);
      assert(lbBeforeB.json.data.rows.length === 3, `Expected 3 members, got ${lbBeforeB.json.data.rows.length}`);
      assert(lbBeforeB.json.data.rows.every((r) => r.approvedSeconds === 0 && r.rank === 1 && !("pendingSeconds" in r)), "Expected all 0s rank=1 and NO pendingSeconds in rows");
      assert(lbBeforeB.json.data.me.approvedSeconds === 0 && lbBeforeB.json.data.me.pendingSeconds === 1500, `Unexpected me: ${JSON.stringify(lbBeforeB.json.data.me)}`);

      // Now approve attendances A and B, and approve A's sessions (600+400=1000s) and ONLY 1000s of B's sessions via daily close OR WorkSession admin approval!
      // Wait: check if admin attendance APPROVED + WorkSession approval exists via API, let's check /api/attendance/admin/:id/decision { decision: "APPROVED", approvedSessionIds: [...] } or approve all then see!
      // Let's inspect Member A (both sessions approved = 1000s) & Member B (approve ONLY wsBItem via attendance approval + daily close, or check WorkSession approval endpoint!).
      // Actually let's check what happens when attendance is APPROVED via /api/attendance/admin/:id/decision: let's approve A's attendance; let's check ws statuses via GET /api/work-sessions?userId=
      const decA = await api(`/api/attendance/admin/${attAId}/decision`, {
        method: "PATCH",
        token: adminAuth.token,
        body: { decision: "APPROVED" },
      });
      const decB = await api(`/api/attendance/admin/${attBId}/decision`, {
        method: "PATCH",
        token: adminAuth.token,
        body: { decision: "APPROVED" },
      });
      assert(decA.status === 200 && decB.status === 200, "Attendance approval failed");

      // Check existing seeded scrum leaderboard to test APPROVED history too, AND test tie ranking on seeded + tempScrum!
      const rListB = await api(`/api/work-sessions?userId=${tempMemberB.id}`, { token: adminAuth.token });
      assert(rListB.status === 200 && rListB.json.data.sessions.length >= 2, "Failed fetching Member B sessions");
      const sessB1 = rListB.json.data.sessions.find((s) => s.durationSeconds === 1000);
      assert(sessB1, "Missing 1000s session for B");

      // Approve Member A's sessions (600 + 400 = 1000s) & ONLY B's 1000s session (leaving B's 500s session PENDING!)
      const rListA = await api(`/api/work-sessions?userId=${tempMemberA.id}`, { token: adminAuth.token });
      const aSessIds = rListA.json.data.sessions.map((s) => s.id);
      for (const wsId of [...aSessIds, sessB1.id]) {
        const rApprove = await api(`/api/work-sessions/${wsId}/decision`, {
          method: "PATCH",
          token: adminAuth.token,
          body: { decision: "APPROVED" },
        });
        assert(rApprove.status === 200, `Session approval (${wsId}) expected 200, got ${rApprove.status}`);
      }

      // Verify SPRINT, MONTH, ALL on tempScrumId:
      // Member A: 600 (sprintItem) + 400 (linked project) = 1000s -> tied #1!
      // Member B: 1000 (approved) + 500 (pending) = 1000s approved -> tied #1! pendingSeconds=500 in me ONLY!
      // Member C: 0s -> rank 3! (competition ranking 1, 1, 3)
      for (const period of ["SPRINT", "MONTH", "ALL"]) {
        const lbB = await api(`/api/scrums/${tempScrumId}/leaderboard?period=${period}`, { token: tempMemberB.token });
        assert(lbB.status === 200, `Leaderboard ${period} failed: ${lbB.status}`);
        const d = lbB.json.data;
        assert(d.period === period && d.rows.length === 3, `Unexpected ${period} rows`);
        assert(d.rows[0].approvedSeconds === 1000 && d.rows[0].rank === 1, `${period} rank 1 mismatch`);
        assert(d.rows[1].approvedSeconds === 1000 && d.rows[1].rank === 1, `${period} tie rank 1 mismatch`);
        assert(d.rows[2].approvedSeconds === 0 && d.rows[2].rank === 3, `${period} rank 3 mismatch: got ${d.rows[2].rank}`);
        assert(d.rows.every((r) => !("pendingSeconds" in r)), `${period} leaked pendingSeconds into rows`);
        assert(d.me.rank === 1 && d.me.approvedSeconds === 1000 && d.me.pendingSeconds === 500, `${period} B.me mismatch: ${JSON.stringify(d.me)}`);
        assert(findCodeKeys(lbB.json).length === 0, "Leaked code key");
      }

      // Non-member editor (tempScrumAdmin) and SUPER_ADMIN get me.rank = null & are NOT in rows
      const lbAdmin = await api(`/api/scrums/${tempScrumId}/leaderboard?period=SPRINT`, { token: tempScrumAdmin.token });
      const lbSa = await api(`/api/scrums/${tempScrumId}/leaderboard?period=ALL`, { token: saAuth.token });
      assert(lbAdmin.status === 200 && lbAdmin.json.data.me.rank === null && lbAdmin.json.data.rows.length === 3, "Non-member editor me.rank must be null");
      assert(lbSa.status === 200 && lbSa.json.data.me.rank === null, "Non-member SA me.rank must be null");

      // Invalid foreign sprintId returns 404
      const lbBadSp = await api(`/api/scrums/${tempScrumId}/leaderboard?period=SPRINT&sprintId=${seededScrum.activeSprint.id}`, { token: saAuth.token });
      assert(lbBadSp.status === 404, `Foreign sprintId expected 404, got ${lbBadSp.status}`);

      // Verify seededScrum leaderboard shows seeded APPROVED data cleanly (IT1102=2700s, IT1101=1500s)
      const lbSeeded = await api(`/api/scrums/${seededScrum.id}/leaderboard?period=ALL`, { token: member1Auth.token });
      assert(lbSeeded.status === 200, "Seeded scrum leaderboard failed");
      assert(lbSeeded.json.data.rows[0]?.approvedSeconds === 2700, `Expected IT1102 2700s at #1, got ${lbSeeded.json.data.rows[0]?.approvedSeconds}`);
      assert(lbSeeded.json.data.me.approvedSeconds === 1500 && lbSeeded.json.data.me.pendingSeconds > 0, "Seeded member1 me mismatch");
      return "1000s/1000s/0s -> ranks 1,1,3 + me.pendingSeconds=500 + seeded verified";
    });

    await runCheck("Dashboard", "GET /api/scrum-admin/dashboard aggregates scrums, distinct members, KPI & todayEvents; 403 for USER/ADMIN", async () => {
      const rForbU = await api("/api/scrum-admin/dashboard", { token: tempMemberA.token });
      const rForbA = await api("/api/scrum-admin/dashboard", { token: adminAuth.token });
      assert(rForbU.status === 403 && rForbA.status === 403, "Expected 403 for USER/ADMIN");

      const rAdm = await api("/api/scrum-admin/dashboard", { token: tempScrumAdmin.token });
      assert(rAdm.status === 200, `Admin dashboard failed: ${rAdm.status}`);
      const d = rAdm.json.data;
      assert(d.totals.scrums === 1, `Expected 1 assigned scrum for tempScrumAdmin, got ${d.totals.scrums}`);
      assert(d.totals.members === 3, `Expected 3 members, got ${d.totals.members}`);
      assert(d.totals.activeSprints === 1 && d.totals.openItems === 2 && d.totals.totalPoints === 13, `Unexpected sprint totals: ${JSON.stringify(d.totals)}`);
      assert(d.scrums[0].linkedProjectCount === 2, `Expected 2 linked projects, got ${d.scrums[0].linkedProjectCount}`);
      assert(d.scrums[0].kpi.total === 2 && d.scrums[0].kpi.belowMin === 1 && d.scrums[0].kpi.onTarget === 1, `Unexpected KPI counts: ${JSON.stringify(d.scrums[0].kpi)}`);
      assert(d.todayEvents.length === 2, `Expected 2 today events, got ${d.todayEvents.length}`);

      // Verify distinct member deduplication for SUPER_ADMIN across multiple scrums (tempMemberA is in BOTH tempScrumId and tempScrum2Id)
      const rSaDash = await api("/api/scrum-admin/dashboard", { token: saAuth.token });
      assert(rSaDash.status === 200, "SA dashboard failed");
      const sumCounts = rSaDash.json.data.scrums.reduce((acc, s) => acc + s.memberCount, 0);
      assert(rSaDash.json.data.totals.members < sumCounts, `Expected distinct members (${rSaDash.json.data.totals.members}) < sum(${sumCounts})`);
      assert(findCodeKeys(rSaDash.json).length === 0, "Leaked code key in dashboard");
      return `scrums=${d.totals.scrums}, saDistinct=${rSaDash.json.data.totals.members}<${sumCounts}`;
    });

    // ---------------------------------------------------------
    // I. Unlink & Archive Behavior on WorkTargets & SprintItems + Delete Guards
    // ---------------------------------------------------------
    await runCheck("UnlinkProject", "DELETE /scrums/:id/projects/:projectId/link nulls SprintProject.projectId & restores studioProjects", async () => {
      const rUnlink = await api(`/api/scrums/${tempScrumId}/projects/${standaloneProjId}/link`, {
        method: "DELETE",
        token: tempScrumAdmin.token,
      });
      assert(rUnlink.status === 200, `Unlink failed: ${rUnlink.status}`);

      // Sprint details shows itemA.projectId === null now!
      const rSpr = await api(`/api/sprints/${sprint1.id}`, { token: tempScrumAdmin.token });
      const fetchedA = rSpr.json.data.projects.find((p) => p.id === itemA.id);
      assert(fetchedA && fetchedA.projectId === null && fetchedA.project === null, "SprintProject.projectId not nulled on unlink");

      // WorkTargets shows standaloneProjId back in studioProjects!
      const wt = await api("/api/work-targets/mine", { token: tempMemberA.token });
      assert(wt.json.data.studioProjects.some((p) => p.id === standaloneProjId), "Unlinked project did not return to studioProjects");

      // Archive tempScrum2 -> otherScrumProjId returns to tempMemberA's studioProjects!
      await api(`/api/scrums/${tempScrum2Id}`, {
        method: "PATCH",
        token: saAuth.token,
        body: { isActive: false },
      });
      const wtArch = await api("/api/work-targets/mine", { token: tempMemberA.token });
      assert(wtArch.json.data.studioProjects.some((p) => p.id === otherScrumProjId), "Archived scrum project did not return to studioProjects");
      await api(`/api/scrums/${tempScrum2Id}`, {
        method: "PATCH",
        token: saAuth.token,
        body: { isActive: true },
      });

      // PATCH /api/projects/:id { scrumId } moves project between scrums & null unlinks cleanly
      const rMoveProj = await api(`/api/projects/${otherScrumProjId}`, {
        method: "PATCH",
        token: saAuth.token,
        body: { scrumId: tempScrumId },
      });
      assert(rMoveProj.status === 200 && rMoveProj.json.data.scrumId === tempScrumId, `Move project failed: ${rMoveProj.status}`);
      const rNullProj = await api(`/api/projects/${otherScrumProjId}`, {
        method: "PATCH",
        token: saAuth.token,
        body: { scrumId: null },
      });
      assert(rNullProj.status === 200 && rNullProj.json.data.scrumId === null && rNullProj.json.data.scrum === null, "Unlink via PATCH /api/projects failed");
      return "Unlink + archive + PATCH project.scrumId verified";
    });

    await runCheck("DeleteGuards", "SA gets 409 deleting scrum with sessions; SCRUM_ADMIN gets 409 on sprint/item", async () => {
      const rProj = await api(`/api/sprint-projects/${itemA.id}`, { method: "DELETE", token: tempScrumAdmin.token });
      const rSpr = await api(`/api/sprints/${sprint1.id}`, { method: "DELETE", token: tempScrumAdmin.token });
      const rScr = await api(`/api/scrums/${tempScrumId}`, { method: "DELETE", token: saAuth.token });
      assert(rProj.status === 409 && rSpr.status === 409 && rScr.status === 409, `Expected all 409, got ${rProj.status}/${rSpr.status}/${rScr.status}`);
      return "All 3 -> 409";
    });

    // ---------------------------------------------------------
    // J. Role / Active Cache Invalidation & ScrumAdmin Cleanup
    // ---------------------------------------------------------
    await runCheck("CacheInvalidation", "PATCH /api/users/:id role change away from SCRUM_ADMIN removes ScrumAdmin & updates JWT immediately", async () => {
      // Promote tempMemberC (USER -> SCRUM_ADMIN)
      const rProm = await api(`/api/users/${tempMemberC.id}`, {
        method: "PATCH",
        token: saAuth.token,
        body: { role: "SCRUM_ADMIN" },
      });
      assert(rProm.status === 200, `Promote failed: ${rProm.status}`);

      // Existing JWT immediately works on /api/scrum-admin/dashboard (200)
      const rDashProm = await api("/api/scrum-admin/dashboard", { token: tempMemberC.token });
      assert(rDashProm.status === 200 && rDashProm.json.data.totals.scrums === 0, "Promoted user dashboard failed");

      // Assign tempMemberC as admin on tempScrum2Id -> verify myRole=ADMIN immediately
      const rAssign = await api(`/api/scrums/${tempScrum2Id}/admins`, {
        method: "PUT",
        token: saAuth.token,
        body: { userIds: [tempScrumAdmin2.id, tempMemberC.id] },
      });
      assert(rAssign.status === 200, "Assign promoted user as scrum admin failed");

      const rDetailsBefore = await api(`/api/scrums/${tempScrum2Id}`, { token: tempMemberC.token });
      assert(rDetailsBefore.status === 200 && rDetailsBefore.json.data.myRole === "ADMIN", "Expected myRole=ADMIN before demotion");

      // Change role back to USER -> removes ScrumAdmin row + immediately demotes existing JWT!
      const rDemUser = await api(`/api/users/${tempMemberC.id}`, {
        method: "PATCH",
        token: saAuth.token,
        body: { role: "USER" },
      });
      assert(rDemUser.status === 200, "Demote to USER failed");

      const rDashBlocked = await api("/api/scrum-admin/dashboard", { token: tempMemberC.token });
      const rScrum2Gone = await api(`/api/scrums/${tempScrum2Id}`, { token: tempMemberC.token });
      assert(rDashBlocked.status === 403, `Demoted USER dashboard expected 403, got ${rDashBlocked.status}`);
      assert(rScrum2Gone.status === 404, `Removed ScrumAdmin non-member expected 404, got ${rScrum2Gone.status}`);

      // Check deactivating SCRUM_ADMIN deletes ScrumAdmin rows
      const rDeact = await api(`/api/users/${tempScrumAdmin2.id}`, {
        method: "PATCH",
        token: saAuth.token,
        body: { isActive: false },
      });
      assert(rDeact.status === 200, "Deactivate failed");
      const rCheckAdmins = await api(`/api/scrums/${tempScrum2Id}`, { token: saAuth.token });
      assert(
        rCheckAdmins.status === 200 && rCheckAdmins.json.data.admins.length === 0,
        `Deactivated user still in ScrumAdmin: ${JSON.stringify(rCheckAdmins.json.data.admins)}`
      );
      return "USER -> SCRUM_ADMIN -> USER + isActive=false ScrumAdmin cleanup verified";
    });
  } finally {
    if (saAuth?.token) {
      // Order matters: Projects first (frees createdById), Users second (cascades WorkSessions), Scrums last
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
