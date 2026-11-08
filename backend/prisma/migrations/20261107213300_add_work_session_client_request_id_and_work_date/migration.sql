-- AlterTable
ALTER TABLE "WorkSession" ADD COLUMN     "clientRequestId" VARCHAR(64),
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "workDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "WorkSession_workDate_idx" ON "WorkSession"("workDate");

-- CreateIndex
CREATE UNIQUE INDEX "WorkSession_userId_clientRequestId_key" ON "WorkSession"("userId", "clientRequestId");

