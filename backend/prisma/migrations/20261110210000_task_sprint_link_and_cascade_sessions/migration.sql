-- 1. Optional Sprint link on Scrum Task (ON DELETE SET NULL keeps tasks if Sprint is removed)
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "sprintId" INTEGER;
CREATE INDEX IF NOT EXISTS "Task_sprintId_idx" ON "Task"("sprintId");

ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_sprintId_fkey";
ALTER TABLE "Task"
  ADD CONSTRAINT "Task_sprintId_fkey"
  FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. Cascade delete WorkSessions when their parent Task is deleted
ALTER TABLE "WorkSession" DROP CONSTRAINT IF EXISTS "WorkSession_taskId_fkey";
ALTER TABLE "WorkSession"
  ADD CONSTRAINT "WorkSession_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

