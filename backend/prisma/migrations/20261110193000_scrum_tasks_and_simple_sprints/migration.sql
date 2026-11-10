-- 1. Add manual progressPercent to Sprint
ALTER TABLE "Sprint"
  ADD COLUMN IF NOT EXISTS "progressPercent" INTEGER NOT NULL DEFAULT 0;

-- 2. Create Task & TaskMember tables
CREATE TABLE "Task" (
  "id" SERIAL NOT NULL,
  "scrumId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "points" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskMember" (
  "taskId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedById" INTEGER,

  CONSTRAINT "TaskMember_pkey" PRIMARY KEY ("taskId", "userId")
);

CREATE INDEX "Task_scrumId_idx" ON "Task"("scrumId");
CREATE INDEX "Task_isActive_idx" ON "Task"("isActive");
CREATE INDEX "TaskMember_userId_idx" ON "TaskMember"("userId");
CREATE INDEX "TaskMember_assignedById_idx" ON "TaskMember"("assignedById");

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_scrumId_fkey"
  FOREIGN KEY ("scrumId") REFERENCES "Scrum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskMember"
  ADD CONSTRAINT "TaskMember_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskMember"
  ADD CONSTRAINT "TaskMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskMember"
  ADD CONSTRAINT "TaskMember_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Add WorkSession.taskId column & FK
ALTER TABLE "WorkSession" ADD COLUMN "taskId" INTEGER;
CREATE INDEX "WorkSession_taskId_idx" ON "WorkSession"("taskId");

ALTER TABLE "WorkSession"
  ADD CONSTRAINT "WorkSession_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Backfill existing SprintProject rows into Task & TaskMember and remap WorkSession.taskId
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'SprintProject'
  ) THEN
    INSERT INTO "Task" ("id", "scrumId", "name", "description", "points", "isActive", "createdAt", "updatedAt")
    SELECT sp."id", s."scrumId", sp."name", NULL, sp."points", (sp."status" <> 'DONE'), sp."createdAt", sp."updatedAt"
    FROM "SprintProject" sp
    JOIN "Sprint" s ON s."id" = sp."sprintId"
    ON CONFLICT ("id") DO NOTHING;

    PERFORM setval(
      pg_get_serial_sequence('"Task"', 'id'),
      COALESCE((SELECT MAX("id") FROM "Task"), 1),
      EXISTS (SELECT 1 FROM "Task")
    );

    INSERT INTO "TaskMember" ("taskId", "userId", "assignedAt")
    SELECT sp."id", sp."assigneeId", sp."createdAt"
    FROM "SprintProject" sp
    JOIN "Task" t ON t."id" = sp."id"
    WHERE sp."assigneeId" IS NOT NULL
    ON CONFLICT ("taskId", "userId") DO NOTHING;

    UPDATE "WorkSession"
    SET "taskId" = "sprintProjectId"
    WHERE "sprintProjectId" IS NOT NULL;
  END IF;
END $$;

-- 5. Swap WorkSession XOR constraint and drop sprintProjectId
ALTER TABLE "WorkSession" DROP CONSTRAINT IF EXISTS "WorkSession_project_or_sprint_check";
ALTER TABLE "WorkSession" DROP CONSTRAINT IF EXISTS "WorkSession_sprintProjectId_fkey";
DROP INDEX IF EXISTS "WorkSession_sprintProjectId_idx";
ALTER TABLE "WorkSession" DROP COLUMN IF EXISTS "sprintProjectId";

ALTER TABLE "WorkSession"
  ADD CONSTRAINT "WorkSession_project_or_task_check"
  CHECK (("projectId" IS NOT NULL AND "taskId" IS NULL) OR ("projectId" IS NULL AND "taskId" IS NOT NULL));

-- 6. Drop legacy SprintProject table & ItemStatus enum
DROP TABLE IF EXISTS "SprintProject";
DROP TYPE IF EXISTS "ItemStatus";

-- 7. Remove Project.scrumId separation
ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_scrumId_fkey";
DROP INDEX IF EXISTS "Project_scrumId_idx";
ALTER TABLE "Project" DROP COLUMN IF EXISTS "scrumId";

