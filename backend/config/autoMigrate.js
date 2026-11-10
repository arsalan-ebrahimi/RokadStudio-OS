import prisma from "./prisma.js";

let isSynced = false;
let syncPromise = null;

export const ensureSchemaUpdated = async () => {
  if (isSynced) return;
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    try {
      // Execute resilient, idempotent DDL migration block on PostgreSQL
      await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          -- 1. Ensure ApprovalStatus enum exists
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApprovalStatus') THEN
            CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
          END IF;

          -- 2. Ensure DecisionSource enum exists
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DecisionSource') THEN
            CREATE TYPE "DecisionSource" AS ENUM ('USER', 'ADMIN', 'SYSTEM');
          END IF;

          -- 3. Ensure Attendance.reason exists
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'Attendance' AND column_name = 'reason'
          ) THEN
            ALTER TABLE "Attendance" ADD COLUMN "reason" TEXT;
          END IF;

          -- 4. Ensure WorkSession.approval exists
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'WorkSession' AND column_name = 'approval'
          ) THEN
            ALTER TABLE "WorkSession" ADD COLUMN "approval" "ApprovalStatus" NOT NULL DEFAULT 'PENDING';
          END IF;

          -- 5. Ensure WorkSession.source exists
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'WorkSession' AND column_name = 'source'
          ) THEN
            ALTER TABLE "WorkSession" ADD COLUMN "source" "DecisionSource" NOT NULL DEFAULT 'USER';
          END IF;

          -- 6. Ensure WorkSession.decidedById exists
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'WorkSession' AND column_name = 'decidedById'
          ) THEN
            ALTER TABLE "WorkSession" ADD COLUMN "decidedById" INTEGER;
          END IF;

          -- 7. Ensure WorkSession.decidedAt exists
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'WorkSession' AND column_name = 'decidedAt'
          ) THEN
            ALTER TABLE "WorkSession" ADD COLUMN "decidedAt" TIMESTAMP(3);
          END IF;

          -- 8. Ensure foreign key decidedById references User
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'WorkSession_decidedById_fkey'
          ) THEN
            ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_decidedById_fkey" 
              FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;

          -- 9. Update Project foreign key to CASCADE on delete
          IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'WorkSession_projectId_fkey'
          ) THEN
            ALTER TABLE "WorkSession" DROP CONSTRAINT "WorkSession_projectId_fkey";
            ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_projectId_fkey" 
              FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;

          -- 10. Ensure indexes for high performance
          IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'WorkSession' AND indexname = 'WorkSession_approval_idx'
          ) THEN
            CREATE INDEX "WorkSession_approval_idx" ON "WorkSession"("approval");
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'WorkSession' AND indexname = 'WorkSession_workDate_approval_idx'
          ) THEN
            CREATE INDEX "WorkSession_workDate_approval_idx" ON "WorkSession"("workDate", "approval");
          END IF;

          -- 11. Add SCRUM_ADMIN to Role enum if not present
          BEGIN
            ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SCRUM_ADMIN';
          EXCEPTION
            WHEN duplicate_object THEN null;
          END;

          -- 12. Scrum Enums
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ScrumColor') THEN
            CREATE TYPE "ScrumColor" AS ENUM ('ECOSYSTEM', 'MALE', 'FEMALE', 'COLLEGE', 'CLUB');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SprintStatus') THEN
            CREATE TYPE "SprintStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventScheduleType') THEN
            CREATE TYPE "EventScheduleType" AS ENUM ('WEEKLY', 'ONCE');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'KpiStatus') THEN
            CREATE TYPE "KpiStatus" AS ENUM ('BELOW_MIN', 'IN_RANGE', 'ON_TARGET');
          END IF;

          -- 13. Create Scrum Table
          CREATE TABLE IF NOT EXISTS "Scrum" (
            "id" SERIAL PRIMARY KEY,
            "name" TEXT NOT NULL,
            "description" TEXT,
            "color" "ScrumColor" NOT NULL DEFAULT 'ECOSYSTEM',
            "isActive" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          );

          -- 13b. Create ScrumAdmin Table and migrate legacy ownerId if present
          CREATE TABLE IF NOT EXISTS "ScrumAdmin" (
            "scrumId" INTEGER NOT NULL REFERENCES "Scrum"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "assignedById" INTEGER REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
            PRIMARY KEY ("scrumId", "userId")
          );

          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'Scrum' AND column_name = 'ownerId'
          ) THEN
            INSERT INTO "ScrumAdmin" ("scrumId", "userId")
            SELECT s."id", s."ownerId"
            FROM "Scrum" s
            JOIN "User" u ON u."id" = s."ownerId"
            WHERE s."ownerId" IS NOT NULL AND u."role" = 'SCRUM_ADMIN'
            ON CONFLICT ("scrumId", "userId") DO NOTHING;

            ALTER TABLE "Scrum" DROP CONSTRAINT IF EXISTS "Scrum_ownerId_fkey";
            DROP INDEX IF EXISTS "Scrum_ownerId_idx";
            ALTER TABLE "Scrum" DROP COLUMN IF EXISTS "ownerId";
          END IF;

          -- 13c. Ensure Project is strictly decoupled from Scrum
          ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_scrumId_fkey";
          DROP INDEX IF EXISTS "Project_scrumId_idx";
          ALTER TABLE "Project" DROP COLUMN IF EXISTS "scrumId";

          -- 14. Create ScrumMember Table
          CREATE TABLE IF NOT EXISTS "ScrumMember" (
            "scrumId" INTEGER NOT NULL REFERENCES "Scrum"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            "label" TEXT,
            PRIMARY KEY ("scrumId", "userId")
          );

          -- 15. Create Sprint Table & ensure progressPercent column
          CREATE TABLE IF NOT EXISTS "Sprint" (
            "id" SERIAL PRIMARY KEY,
            "scrumId" INTEGER NOT NULL REFERENCES "Scrum"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            "number" INTEGER NOT NULL,
            "title" TEXT NOT NULL,
            "description" TEXT,
            "startDate" DATE,
            "endDate" DATE,
            "status" "SprintStatus" NOT NULL DEFAULT 'PLANNED',
            "progressPercent" INTEGER NOT NULL DEFAULT 0,
            "completedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "Sprint_scrumId_number_key" UNIQUE ("scrumId", "number")
          );

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'Sprint' AND column_name = 'progressPercent'
          ) THEN
            ALTER TABLE "Sprint" ADD COLUMN "progressPercent" INTEGER NOT NULL DEFAULT 0;
          END IF;

          -- 16. Create Task & TaskMember Tables
          CREATE TABLE IF NOT EXISTS "Task" (
            "id" SERIAL PRIMARY KEY,
            "scrumId" INTEGER NOT NULL REFERENCES "Scrum"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            "sprintId" INTEGER REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE,
            "name" TEXT NOT NULL,
            "description" TEXT,
            "points" INTEGER NOT NULL DEFAULT 0,
            "isActive" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          );

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'Task' AND column_name = 'sprintId'
          ) THEN
            ALTER TABLE "Task" ADD COLUMN "sprintId" INTEGER;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'Task_sprintId_fkey'
          ) THEN
            ALTER TABLE "Task" ADD CONSTRAINT "Task_sprintId_fkey"
              FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;

          CREATE TABLE IF NOT EXISTS "TaskMember" (
            "taskId" INTEGER NOT NULL REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "assignedById" INTEGER REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
            PRIMARY KEY ("taskId", "userId")
          );

          -- 17. Create ScrumKpi Table & migrate string targets + manual progress/status
          CREATE TABLE IF NOT EXISTS "ScrumKpi" (
            "id" SERIAL PRIMARY KEY,
            "scrumId" INTEGER NOT NULL REFERENCES "Scrum"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            "indicator" TEXT,
            "formula" TEXT,
            "strategicGoal" TEXT,
            "unit" TEXT,
            "target" TEXT,
            "firstMonthTarget" TEXT,
            "finalTarget" TEXT,
            "actualValue" DECIMAL(12,2),
            "progressPercent" DECIMAL(5,2),
            "status" "KpiStatus",
            "minExpected" DECIMAL(12,2),
            "sortOrder" INTEGER NOT NULL DEFAULT 0,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          );

          ALTER TABLE "ScrumKpi" ADD COLUMN IF NOT EXISTS "finalTarget" TEXT;

          DECLARE
            v_kpi_has_progress BOOLEAN;
            v_kpi_has_status BOOLEAN;
            v_kpi_target_type TEXT;
            v_kpi_first_month_type TEXT;
          BEGIN
            SELECT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_name = 'ScrumKpi' AND column_name = 'progressPercent'
            ) INTO v_kpi_has_progress;

            SELECT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_name = 'ScrumKpi' AND column_name = 'status'
            ) INTO v_kpi_has_status;

            SELECT data_type INTO v_kpi_target_type
            FROM information_schema.columns
            WHERE table_name = 'ScrumKpi' AND column_name = 'target';

            IF NOT v_kpi_has_progress THEN
              ALTER TABLE "ScrumKpi" ADD COLUMN "progressPercent" DECIMAL(5,2);
            END IF;

            IF NOT v_kpi_has_status THEN
              ALTER TABLE "ScrumKpi" ADD COLUMN "status" "KpiStatus";
            END IF;

            IF (NOT v_kpi_has_progress OR NOT v_kpi_has_status)
              AND v_kpi_target_type IS NOT NULL
              AND v_kpi_target_type <> 'text' THEN
              UPDATE "ScrumKpi"
              SET
                "progressPercent" = CASE
                  WHEN "progressPercent" IS NOT NULL THEN "progressPercent"
                  WHEN "actualValue" IS NOT NULL AND "target" IS NOT NULL AND "target" <> 0
                    THEN LEAST(100, GREATEST(0, ROUND(("actualValue" / "target") * 100.0, 2)))::DECIMAL(5,2)
                  ELSE NULL
                END,
                "status" = CASE
                  WHEN "status" IS NOT NULL THEN "status"
                  WHEN "actualValue" IS NULL OR "target" IS NULL THEN NULL
                  WHEN "minExpected" IS NOT NULL AND "actualValue" < "minExpected" THEN 'BELOW_MIN'::"KpiStatus"
                  WHEN "actualValue" >= "target" THEN 'ON_TARGET'::"KpiStatus"
                  ELSE 'IN_RANGE'::"KpiStatus"
                END;
            END IF;

            IF v_kpi_target_type IS NOT NULL AND v_kpi_target_type <> 'text' THEN
              ALTER TABLE "ScrumKpi"
                ALTER COLUMN "target" TYPE TEXT
                USING CASE
                  WHEN "target" IS NULL THEN NULL
                  WHEN "target"::text ~ '\.' THEN REGEXP_REPLACE(REGEXP_REPLACE("target"::text, '0+$', ''), '\.$', '')
                  ELSE "target"::text
                END;
            END IF;

            SELECT data_type INTO v_kpi_first_month_type
            FROM information_schema.columns
            WHERE table_name = 'ScrumKpi' AND column_name = 'firstMonthTarget';

            IF v_kpi_first_month_type IS NOT NULL AND v_kpi_first_month_type <> 'text' THEN
              ALTER TABLE "ScrumKpi"
                ALTER COLUMN "firstMonthTarget" TYPE TEXT
                USING CASE
                  WHEN "firstMonthTarget" IS NULL THEN NULL
                  WHEN "firstMonthTarget"::text ~ '\.' THEN REGEXP_REPLACE(REGEXP_REPLACE("firstMonthTarget"::text, '0+$', ''), '\.$', '')
                  ELSE "firstMonthTarget"::text
                END;
            END IF;
          END;

          -- 18. Create ScrumEvent Table
          CREATE TABLE IF NOT EXISTS "ScrumEvent" (
            "id" SERIAL PRIMARY KEY,
            "scrumId" INTEGER NOT NULL REFERENCES "Scrum"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            "name" TEXT NOT NULL,
            "scheduleType" "EventScheduleType" NOT NULL,
            "dayOfWeek" INTEGER,
            "date" DATE,
            "startTime" TEXT,
            "durationMinutes" INTEGER,
            "inputs" TEXT,
            "outputs" TEXT,
            "sortOrder" INTEGER NOT NULL DEFAULT 0
          );

          -- 19. Alter WorkSession to use taskId and migrate legacy SprintProject rows if present
          ALTER TABLE "WorkSession" ALTER COLUMN "projectId" DROP NOT NULL;
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'WorkSession' AND column_name = 'taskId'
          ) THEN
            ALTER TABLE "WorkSession" ADD COLUMN "taskId" INTEGER;
          END IF;

          -- Ensure Task FK cascades WorkSession deletes automatically
          ALTER TABLE "WorkSession" DROP CONSTRAINT IF EXISTS "WorkSession_taskId_fkey";
          ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_taskId_fkey"
            FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

            IF EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_name = 'WorkSession' AND column_name = 'sprintProjectId'
            ) THEN
              UPDATE "WorkSession"
              SET "taskId" = "sprintProjectId"
              WHERE "sprintProjectId" IS NOT NULL AND "taskId" IS NULL;
            END IF;
          END IF;

          ALTER TABLE "WorkSession" DROP CONSTRAINT IF EXISTS "WorkSession_project_or_sprint_check";
          ALTER TABLE "WorkSession" DROP CONSTRAINT IF EXISTS "WorkSession_sprintProjectId_fkey";
          DROP INDEX IF EXISTS "WorkSession_sprintProjectId_idx";
          ALTER TABLE "WorkSession" DROP COLUMN IF EXISTS "sprintProjectId";

          DROP TABLE IF EXISTS "SprintProject";
          DROP TYPE IF EXISTS "ItemStatus";

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'WorkSession_project_or_task_check'
          ) THEN
            ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_project_or_task_check"
              CHECK (("projectId" IS NOT NULL AND "taskId" IS NULL) OR ("projectId" IS NULL AND "taskId" IS NOT NULL));
          END IF;

          -- 20. Ensure Sprint partial unique index and Scrum performance indexes
          IF NOT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE tablename = 'Sprint' AND indexname = 'Sprint_scrumId_active_unique'
          ) THEN
            CREATE UNIQUE INDEX "Sprint_scrumId_active_unique" ON "Sprint"("scrumId") WHERE "status" = 'ACTIVE';
          END IF;

          CREATE INDEX IF NOT EXISTS "Scrum_isActive_idx" ON "Scrum"("isActive");
          CREATE INDEX IF NOT EXISTS "ScrumAdmin_userId_idx" ON "ScrumAdmin"("userId");
          CREATE INDEX IF NOT EXISTS "ScrumAdmin_assignedById_idx" ON "ScrumAdmin"("assignedById");
          CREATE INDEX IF NOT EXISTS "ScrumMember_userId_idx" ON "ScrumMember"("userId");
          CREATE INDEX IF NOT EXISTS "Sprint_scrumId_status_idx" ON "Sprint"("scrumId", "status");
          CREATE INDEX IF NOT EXISTS "Task_scrumId_idx" ON "Task"("scrumId");
          CREATE INDEX IF NOT EXISTS "Task_sprintId_idx" ON "Task"("sprintId");
          CREATE INDEX IF NOT EXISTS "Task_isActive_idx" ON "Task"("isActive");
          CREATE INDEX IF NOT EXISTS "TaskMember_userId_idx" ON "TaskMember"("userId");
          CREATE INDEX IF NOT EXISTS "TaskMember_assignedById_idx" ON "TaskMember"("assignedById");
          CREATE INDEX IF NOT EXISTS "ScrumKpi_scrumId_idx" ON "ScrumKpi"("scrumId");
          CREATE INDEX IF NOT EXISTS "ScrumEvent_scrumId_idx" ON "ScrumEvent"("scrumId");
          CREATE INDEX IF NOT EXISTS "ScrumEvent_scheduleType_dayOfWeek_idx" ON "ScrumEvent"("scheduleType", "dayOfWeek");
          CREATE INDEX IF NOT EXISTS "ScrumEvent_scheduleType_date_idx" ON "ScrumEvent"("scheduleType", "date");
          CREATE INDEX IF NOT EXISTS "WorkSession_taskId_idx" ON "WorkSession"("taskId");
        END $$;
      `);
      isSynced = true;
      console.log("[AutoMigrate] Database schema verified and up to date.");
    } catch (err) {
      console.warn("[AutoMigrate] Schema sync notice:", err.message || err);
      // Do not mark synced on failure so subsequent checks can retry once DB is ready
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
};

