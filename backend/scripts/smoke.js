import assert from "node:assert/strict";
import prisma from "../config/prisma.js";
import { runSeed } from "../prisma/seed.js";

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

const request = async (path, options = {}) => {
  const url = `${BASE_URL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.token && { Authorization: `Bearer ${options.token}` }),
    ...options.headers,
  };

  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    ...(options.body && { body: JSON.stringify(options.body) }),
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  return { status: res.status, ok: res.ok, data: json };
};

const assertEqual = (actual, expected, message) => {
  if (actual !== expected) {
    console.error(`Assertion failed: ${message}. Expected: ${expected}, Got: ${actual}`);
    process.exit(1);
  }
};

const runSmoke = async () => {
  console.log("=== Starting Rokad Platform End-to-End Smoke Test ===");

  // 1. Health check
  console.log("1. Checking /health");
  const health = await request("/health");
  assertEqual(health.status, 200, "Health endpoint should return 200");
  assertEqual(health.data.success, true, "Health success should be true");

  // Seed super admin
  await runSeed();
  const superAdminCode = process.env.SEED_SUPERADMIN_CODE || "super_admin_2026";

  // 2. SuperAdmin Login
  console.log("2. SuperAdmin Login");
  const saLogin = await request("/api/auth/login", {
    method: "POST",
    body: { code: superAdminCode },
  });
  assertEqual(saLogin.status, 200, "SuperAdmin login should succeed");
  const saToken = saLogin.data.data.token;

  // 3. SuperAdmin /api/auth/me
  console.log("3. SuperAdmin /api/auth/me");
  const saMe = await request("/api/auth/me", { token: saToken });
  assertEqual(saMe.status, 200, "SuperAdmin me should succeed");
  assertEqual(saMe.data.data.role, "SUPER_ADMIN", "Role must be SUPER_ADMIN");

  // 4. Create User 1
  const u1Code = String(Math.floor(100000 + Math.random() * 899999));
  console.log("4. Creating User 1 via POST /api/users");
  const cu1 = await request("/api/users", {
    method: "POST",
    token: saToken,
    body: { code: u1Code, name: "Smoke User One", role: "USER" },
  });
  assertEqual(cu1.status, 201, "User creation should return 201");
  const user1 = cu1.data.data;

  // 5. Create Admin 1
  const a1Code = String(Math.floor(100000 + Math.random() * 899999));
  console.log("5. Creating Admin 1 via POST /api/users");
  const ca1 = await request("/api/users", {
    method: "POST",
    token: saToken,
    body: { code: a1Code, name: "Smoke Admin One", role: "ADMIN" },
  });
  assertEqual(ca1.status, 201, "Admin creation should return 201");
  const admin1 = ca1.data.data;

  // 6. Admin Login
  console.log("6. Admin Login");
  const aLogin = await request("/api/auth/login", {
    method: "POST",
    body: { code: a1Code },
  });
  assertEqual(aLogin.status, 200, "Admin login should succeed");
  const adminToken = aLogin.data.data.token;

  // 7. Minimal User Search (ADMIN)
  console.log("7. Minimal User Search via GET /api/users/search");
  const searchRes = await request("/api/users/search?q=Smoke", { token: adminToken });
  assertEqual(searchRes.status, 200, "Search should return 200");
  assertEqual(searchRes.data.data.some((u) => u.id === user1.id), true, "User1 must be in search results");

  // 8. User 1 Login
  console.log("8. User 1 Login");
  const u1Login = await request("/api/auth/login", {
    method: "POST",
    body: { code: u1Code },
  });
  assertEqual(u1Login.status, 200, "User 1 login should succeed");
  const u1Token = u1Login.data.data.token;

  // 9. Check today's attendance before declaring (should be null)
  console.log("9. User 1 checks today attendance (expect null)");
  const attBefore = await request("/api/attendance/today", { token: u1Token });
  assertEqual(attBefore.status, 200, "Today attendance should return 200");
  assertEqual(attBefore.data.data, null, "Attendance should initially be null");

  // 10. User 1 declares PRESENT
  console.log("10. User 1 declares PRESENT via POST /api/attendance/today");
  const attPost = await request("/api/attendance/today", {
    method: "POST",
    token: u1Token,
    body: { status: "PRESENT" },
  });
  assertEqual(attPost.status, 201, "Attendance post should return 201");
  assertEqual(attPost.data.data.status, "PRESENT", "Status must be PRESENT");
  assertEqual(attPost.data.data.approval, "PENDING", "Approval must be PENDING");
  const attendanceId = attPost.data.data.id;

  // 11. Second declaration attempt should fail with 409
  console.log("11. Second attendance attempt (expect 409)");
  const attPost2 = await request("/api/attendance/today", {
    method: "POST",
    token: u1Token,
    body: { status: "ABSENT" },
  });
  assertEqual(attPost2.status, 409, "Second attendance must return 409");

  // 12. Create Project and assign User 1
  console.log("12. SuperAdmin creates Project via POST /api/projects");
  const cp = await request("/api/projects", {
    method: "POST",
    token: saToken,
    body: {
      name: "Smoke Studio Project",
      description: "Project for smoke testing",
      memberIds: [user1.id],
    },
  });
  assertEqual(cp.status, 201, "Project creation should return 201");
  const project = cp.data.data;

  // 13. User 1 lists own projects via GET /api/projects/mine
  console.log("13. User 1 fetches own projects via GET /api/projects/mine");
  const myProjects = await request("/api/projects/mine", { token: u1Token });
  assertEqual(myProjects.status, 200, "Mine projects should return 200");
  assertEqual(myProjects.data.data.some((p) => p.id === project.id), true, "Project must be present");

  // 14. User 1 logs WorkSession 1 (750 seconds)
  console.log("14. User 1 logs session 1 (750 seconds)");
  const ws1 = await request("/api/work-sessions", {
    method: "POST",
    token: u1Token,
    body: { projectId: project.id, durationSeconds: 750 },
  });
  assertEqual(ws1.status, 201, "Session 1 should return 201");

  // 15. User 1 logs WorkSession 2 (825 seconds)
  console.log("15. User 1 logs session 2 (825 seconds)");
  const ws2 = await request("/api/work-sessions", {
    method: "POST",
    token: u1Token,
    body: { projectId: project.id, durationSeconds: 825 },
  });
  assertEqual(ws2.status, 201, "Session 2 should return 201");

  // 16. User 1 checks GET /api/work-sessions/me
  console.log("16. User 1 checks GET /api/work-sessions/me");
  const mySessions = await request("/api/work-sessions/me", { token: u1Token });
  assertEqual(mySessions.status, 200, "Me sessions should return 200");
  assertEqual(mySessions.data.data.totalSeconds, 1575, "Total seconds must be 1575");
  assertEqual(mySessions.data.data.sessions.length, 2, "Sessions count must be 2");

  // 17. Admin reviews attendance list
  console.log("17. Admin lists attendance via GET /api/attendance/admin");
  const adminAtt = await request(`/api/attendance/admin?userId=${user1.id}`, { token: adminToken });
  assertEqual(adminAtt.status, 200, "Admin attendance should return 200");
  const user1AttRecord = adminAtt.data.data.find((r) => r.id === attendanceId);
  assert.ok(user1AttRecord, "Attendance record must be present");
  assertEqual(user1AttRecord.sessionsCount, 2, "Sessions count must be 2");
  assertEqual(user1AttRecord.totalSeconds, 1575, "Total seconds must be 1575");

  // 18. Admin checks WorkSessions summary
  console.log("18. Admin checks summary via GET /api/work-sessions/summary");
  const summary = await request(`/api/work-sessions/summary?userId=${user1.id}&projectId=${project.id}`, {
    token: adminToken,
  });
  assertEqual(summary.status, 200, "Summary should return 200");
  assertEqual(summary.data.data[0].totalSeconds, 1575, "Summary total seconds must be 1575");
  assertEqual(summary.data.data[0].sessionsCount, 2, "Summary sessions count must be 2");

  // 19. Admin rejects User 1 attendance -> Rejection transaction
  console.log("19. Admin rejects attendance via PATCH /api/attendance/admin/:id/decision");
  const rejectRes = await request(`/api/attendance/admin/${attendanceId}/decision`, {
    method: "PATCH",
    token: adminToken,
    body: { decision: "REJECTED" },
  });
  assertEqual(rejectRes.status, 200, "Rejection should return 200");
  assertEqual(rejectRes.data.data.effectiveStatus, "ABSENT", "Effective status must be ABSENT");

  // 20. Verify sessions are deleted after rejection
  console.log("20. Verify sessions deleted after rejection via GET /api/work-sessions/me");
  const mySessionsAfter = await request("/api/work-sessions/me", { token: u1Token });
  assertEqual(mySessionsAfter.status, 200, "Me sessions should return 200");
  assertEqual(mySessionsAfter.data.data.sessions.length, 0, "Sessions must be 0 after attendance rejection");
  assertEqual(mySessionsAfter.data.data.totalSeconds, 0, "Total seconds must be 0");

  // 21. Clean up
  console.log("21. Cleanup smoke resources");
  await prisma.attendance.deleteMany({ where: { userId: user1.id } });
  await prisma.projectMember.deleteMany({ where: { projectId: project.id } });
  await prisma.project.delete({ where: { id: project.id } });
  await prisma.user.deleteMany({ where: { id: { in: [user1.id, admin1.id] } } });

  console.log("=== All Smoke Tests Passed Successfully! ===");
};

runSmoke()
  .catch((err) => {
    console.error("Smoke test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
