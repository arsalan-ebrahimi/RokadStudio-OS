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
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ItemStatus') THEN
            CREATE TYPE "ItemStatus" AS ENUM ('TODO', 'DOING', 'DONE');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventScheduleType') THEN
            CREATE TYPE "EventScheduleType" AS ENUM ('WEEKLY', 'ONCE');
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

          -- 13c. Add optional Scrum link on Project
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'Project' AND column_name = 'scrumId'
          ) THEN
            ALTER TABLE "Project" ADD COLUMN "scrumId" INTEGER;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'Project_scrumId_fkey'
          ) THEN
            ALTER TABLE "Project" ADD CONSTRAINT "Project_scrumId_fkey"
              FOREIGN KEY ("scrumId") REFERENCES "Scrum"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;

          -- 14. Create ScrumMember Table
          CREATE TABLE IF NOT EXISTS "ScrumMember" (
            "scrumId" INTEGER NOT NULL REFERENCES "Scrum"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            "label" TEXT,
            PRIMARY KEY ("scrumId", "userId")
          );

          -- 15. Create Sprint Table
          CREATE TABLE IF NOT EXISTS "Sprint" (
            "id" SERIAL PRIMARY KEY,
            "scrumId" INTEGER NOT NULL REFERENCES "Scrum"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            "number" INTEGER NOT NULL,
            "title" TEXT NOT NULL,
            "description" TEXT,
            "startDate" DATE,
            "endDate" DATE,
            "status" "SprintStatus" NOT NULL DEFAULT 'PLANNED',
            "completedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "Sprint_scrumId_number_key" UNIQUE ("scrumId", "number")
          );

          -- 16. Create SprintProject Table
          CREATE TABLE IF NOT EXISTS "SprintProject" (
            "id" SERIAL PRIMARY KEY,
            "sprintId" INTEGER NOT NULL REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            "projectId" INTEGER REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE,
            "name" TEXT NOT NULL,
            "points" INTEGER NOT NULL DEFAULT 0,
            "assigneeId" INTEGER REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
            "status" "ItemStatus" NOT NULL DEFAULT 'TODO',
            "sortOrder" INTEGER NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          );

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'SprintProject' AND column_name = 'projectId'
          ) THEN
            ALTER TABLE "SprintProject" ADD COLUMN "projectId" INTEGER;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'SprintProject_projectId_fkey'
          ) THEN
            ALTER TABLE "SprintProject" ADD CONSTRAINT "SprintProject_projectId_fkey"
              FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;

          -- 17. Create ScrumKpi Table
          CREATE TABLE IF NOT EXISTS "ScrumKpi" (
            "id" SERIAL PRIMARY KEY,
            "scrumId" INTEGER NOT NULL REFERENCES "Scrum"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            "indicator" TEXT,
            "formula" TEXT,
            "strategicGoal" TEXT,
            "unit" TEXT,
            "target" DECIMAL(12,2),
            "firstMonthTarget" DECIMAL(12,2),
            "actualValue" DECIMAL(12,2),
            "minExpected" DECIMAL(12,2),
            "sortOrder" INTEGER NOT NULL DEFAULT 0,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          );

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

          -- 19. Alter WorkSession
          ALTER TABLE "WorkSession" ALTER COLUMN "projectId" DROP NOT NULL;
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'WorkSession' AND column_name = 'sprintProjectId'
          ) THEN
            ALTER TABLE "WorkSession" ADD COLUMN "sprintProjectId" INTEGER;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'WorkSession_sprintProjectId_fkey'
          ) THEN
            ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_sprintProjectId_fkey" 
              FOREIGN KEY ("sprintProjectId") REFERENCES "SprintProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'WorkSession_project_or_sprint_check'
          ) THEN
            ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_project_or_sprint_check" 
              CHECK (("projectId" IS NOT NULL AND "sprintProjectId" IS NULL) OR ("projectId" IS NULL AND "sprintProjectId" IS NOT NULL));
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
          CREATE INDEX IF NOT EXISTS "Project_scrumId_idx" ON "Project"("scrumId");
          CREATE INDEX IF NOT EXISTS "ScrumMember_userId_idx" ON "ScrumMember"("userId");
          CREATE INDEX IF NOT EXISTS "Sprint_scrumId_status_idx" ON "Sprint"("scrumId", "status");
          CREATE INDEX IF NOT EXISTS "SprintProject_sprintId_idx" ON "SprintProject"("sprintId");
          CREATE INDEX IF NOT EXISTS "SprintProject_projectId_idx" ON "SprintProject"("projectId");
          CREATE INDEX IF NOT EXISTS "SprintProject_assigneeId_idx" ON "SprintProject"("assigneeId");
          CREATE INDEX IF NOT EXISTS "ScrumKpi_scrumId_idx" ON "ScrumKpi"("scrumId");
          CREATE INDEX IF NOT EXISTS "ScrumEvent_scrumId_idx" ON "ScrumEvent"("scrumId");
          CREATE INDEX IF NOT EXISTS "ScrumEvent_scheduleType_dayOfWeek_idx" ON "ScrumEvent"("scheduleType", "dayOfWeek");
          CREATE INDEX IF NOT EXISTS "ScrumEvent_scheduleType_date_idx" ON "ScrumEvent"("scheduleType", "date");
          CREATE INDEX IF NOT EXISTS "WorkSession_sprintProjectId_idx" ON "WorkSession"("sprintProjectId");
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

