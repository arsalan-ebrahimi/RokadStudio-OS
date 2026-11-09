-- AlterEnum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SCRUM_ADMIN';

-- CreateEnum
CREATE TYPE "ScrumColor" AS ENUM ('ECOSYSTEM', 'MALE', 'FEMALE', 'COLLEGE', 'CLUB');

-- CreateEnum
CREATE TYPE "SprintStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('TODO', 'DOING', 'DONE');

-- CreateEnum
CREATE TYPE "EventScheduleType" AS ENUM ('WEEKLY', 'ONCE');

-- CreateTable
CREATE TABLE "Scrum" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" "ScrumColor" NOT NULL DEFAULT 'ECOSYSTEM',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scrum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrumMember" (
    "scrumId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "label" TEXT,

    CONSTRAINT "ScrumMember_pkey" PRIMARY KEY ("scrumId","userId")
);

-- CreateTable
CREATE TABLE "Sprint" (
    "id" SERIAL NOT NULL,
    "scrumId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "status" "SprintStatus" NOT NULL DEFAULT 'PLANNED',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SprintProject" (
    "id" SERIAL NOT NULL,
    "sprintId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "assigneeId" INTEGER,
    "status" "ItemStatus" NOT NULL DEFAULT 'TODO',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrumKpi" (
    "id" SERIAL NOT NULL,
    "scrumId" INTEGER NOT NULL,
    "indicator" TEXT,
    "formula" TEXT,
    "strategicGoal" TEXT,
    "unit" TEXT,
    "target" DECIMAL(12,2),
    "firstMonthTarget" DECIMAL(12,2),
    "actualValue" DECIMAL(12,2),
    "minExpected" DECIMAL(12,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrumKpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrumEvent" (
    "id" SERIAL NOT NULL,
    "scrumId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "scheduleType" "EventScheduleType" NOT NULL,
    "dayOfWeek" INTEGER,
    "date" DATE,
    "startTime" TEXT,
    "durationMinutes" INTEGER,
    "inputs" TEXT,
    "outputs" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ScrumEvent_pkey" PRIMARY KEY ("id")
);

-- AlterTable WorkSession: make projectId nullable, add sprintProjectId
ALTER TABLE "WorkSession" ALTER COLUMN "projectId" DROP NOT NULL;
ALTER TABLE "WorkSession" ADD COLUMN IF NOT EXISTS "sprintProjectId" INTEGER;

-- Check constraint: exactly one of projectId / sprintProjectId is NOT NULL
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_project_or_sprint_check" 
    CHECK (("projectId" IS NOT NULL AND "sprintProjectId" IS NULL) OR ("projectId" IS NULL AND "sprintProjectId" IS NOT NULL));

-- CreateIndexes
CREATE INDEX "Scrum_ownerId_idx" ON "Scrum"("ownerId");
CREATE INDEX "Scrum_isActive_idx" ON "Scrum"("isActive");
CREATE INDEX "ScrumMember_userId_idx" ON "ScrumMember"("userId");
CREATE INDEX "Sprint_scrumId_status_idx" ON "Sprint"("scrumId", "status");
CREATE UNIQUE INDEX "Sprint_scrumId_number_key" ON "Sprint"("scrumId", "number");

-- Partial unique index: only one ACTIVE sprint per scrum
CREATE UNIQUE INDEX "Sprint_scrumId_active_unique" ON "Sprint"("scrumId") WHERE "status" = 'ACTIVE';

CREATE INDEX "SprintProject_sprintId_idx" ON "SprintProject"("sprintId");
CREATE INDEX "SprintProject_assigneeId_idx" ON "SprintProject"("assigneeId");
CREATE INDEX "ScrumKpi_scrumId_idx" ON "ScrumKpi"("scrumId");
CREATE INDEX "ScrumEvent_scrumId_idx" ON "ScrumEvent"("scrumId");
CREATE INDEX "ScrumEvent_scheduleType_dayOfWeek_idx" ON "ScrumEvent"("scheduleType", "dayOfWeek");
CREATE INDEX "ScrumEvent_scheduleType_date_idx" ON "ScrumEvent"("scheduleType", "date");
CREATE INDEX "WorkSession_sprintProjectId_idx" ON "WorkSession"("sprintProjectId");

-- AddForeignKey
ALTER TABLE "Scrum" ADD CONSTRAINT "Scrum_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrumMember" ADD CONSTRAINT "ScrumMember_scrumId_fkey" FOREIGN KEY ("scrumId") REFERENCES "Scrum"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScrumMember" ADD CONSTRAINT "ScrumMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_scrumId_fkey" FOREIGN KEY ("scrumId") REFERENCES "Scrum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintProject" ADD CONSTRAINT "SprintProject_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SprintProject" ADD CONSTRAINT "SprintProject_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrumKpi" ADD CONSTRAINT "ScrumKpi_scrumId_fkey" FOREIGN KEY ("scrumId") REFERENCES "Scrum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrumEvent" ADD CONSTRAINT "ScrumEvent_scrumId_fkey" FOREIGN KEY ("scrumId") REFERENCES "Scrum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_sprintProjectId_fkey" FOREIGN KEY ("sprintProjectId") REFERENCES "SprintProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

