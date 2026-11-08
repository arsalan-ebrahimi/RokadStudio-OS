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
        END $$;
      `);
      isSynced = true;
      console.log("[AutoMigrate] Database schema verified and up to date.");
    } catch (err) {
      console.warn("[AutoMigrate] Schema sync notice:", err.message || err);
      // Fails open: don't crash in case of temporary DB lock or read-only replica
      isSynced = true;
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
};
