-- Additive migration: end-of-work note, scrum/studio performance status, and member workDate index
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PerformanceLevel') THEN
    CREATE TYPE "PerformanceLevel" AS ENUM ('EXCELLENT', 'STRONG', 'AVERAGE', 'WEAK', 'NEEDS_ATTENTION');
  END IF;
END $$;

ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "workNote" TEXT;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "workNoteAt" TIMESTAMP(3);
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "workNotePromptedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Attendance_workNoteAt_idx" ON "Attendance"("workNoteAt");

ALTER TABLE "ScrumMember" ADD COLUMN IF NOT EXISTS "performance" "PerformanceLevel";
ALTER TABLE "ScrumMember" ADD COLUMN IF NOT EXISTS "performanceNote" VARCHAR(500);
ALTER TABLE "ScrumMember" ADD COLUMN IF NOT EXISTS "performanceUpdatedAt" TIMESTAMP(3);
ALTER TABLE "ScrumMember" ADD COLUMN IF NOT EXISTS "performanceUpdatedById" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ScrumMember_performanceUpdatedById_fkey'
  ) THEN
    ALTER TABLE "ScrumMember" ADD CONSTRAINT "ScrumMember_performanceUpdatedById_fkey"
      FOREIGN KEY ("performanceUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ScrumMember_performance_idx" ON "ScrumMember"("performance");
CREATE INDEX IF NOT EXISTS "ScrumMember_performanceUpdatedById_idx" ON "ScrumMember"("performanceUpdatedById");

CREATE TABLE IF NOT EXISTS "StudioPerformance" (
  "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "level" "PerformanceLevel" NOT NULL,
  "note" VARCHAR(500),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedById" INTEGER REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  PRIMARY KEY ("userId")
);

CREATE INDEX IF NOT EXISTS "StudioPerformance_level_idx" ON "StudioPerformance"("level");
CREATE INDEX IF NOT EXISTS "StudioPerformance_updatedById_idx" ON "StudioPerformance"("updatedById");

CREATE INDEX IF NOT EXISTS "WorkSession_userId_workDate_idx" ON "WorkSession"("userId", "workDate");

