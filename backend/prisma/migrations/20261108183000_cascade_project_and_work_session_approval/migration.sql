-- Drop existing Restrict foreign key and re-add with CASCADE
ALTER TABLE "WorkSession" DROP CONSTRAINT IF EXISTS "WorkSession_projectId_fkey";
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add approval and decision audit columns to WorkSession
ALTER TABLE "WorkSession" ADD COLUMN IF NOT EXISTS "approval" "ApprovalStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "WorkSession" ADD COLUMN IF NOT EXISTS "source" "DecisionSource" NOT NULL DEFAULT 'USER';
ALTER TABLE "WorkSession" ADD COLUMN IF NOT EXISTS "decidedById" INTEGER;
ALTER TABLE "WorkSession" ADD COLUMN IF NOT EXISTS "decidedAt" TIMESTAMP(3);

-- Add foreign key relation for decidedById
ALTER TABLE "WorkSession" DROP CONSTRAINT IF EXISTS "WorkSession_decidedById_fkey";
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX IF NOT EXISTS "WorkSession_approval_idx" ON "WorkSession"("approval");
CREATE INDEX IF NOT EXISTS "WorkSession_workDate_approval_idx" ON "WorkSession"("workDate", "approval");

