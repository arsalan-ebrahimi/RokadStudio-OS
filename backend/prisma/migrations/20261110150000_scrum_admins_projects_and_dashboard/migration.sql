-- CreateTable
CREATE TABLE "ScrumAdmin" (
    "scrumId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" INTEGER,

    CONSTRAINT "ScrumAdmin_pkey" PRIMARY KEY ("scrumId","userId")
);

-- Data migration: copy existing Scrum.ownerId rows (for SCRUM_ADMIN users) into ScrumAdmin BEFORE dropping ownerId
INSERT INTO "ScrumAdmin" ("scrumId", "userId")
SELECT s."id", s."ownerId"
FROM "Scrum" s
JOIN "User" u ON u."id" = s."ownerId"
WHERE s."ownerId" IS NOT NULL
  AND u."role" = 'SCRUM_ADMIN'
ON CONFLICT ("scrumId", "userId") DO NOTHING;

-- AlterTable Scrum: remove legacy ownerId FK, index, and column
ALTER TABLE "Scrum" DROP CONSTRAINT IF EXISTS "Scrum_ownerId_fkey";
DROP INDEX IF EXISTS "Scrum_ownerId_idx";
ALTER TABLE "Scrum" DROP COLUMN IF EXISTS "ownerId";

-- AlterTable Project: optional link to Scrum
ALTER TABLE "Project" ADD COLUMN "scrumId" INTEGER;

-- AlterTable SprintProject: optional link to Project
ALTER TABLE "SprintProject" ADD COLUMN "projectId" INTEGER;

-- CreateIndex
CREATE INDEX "ScrumAdmin_userId_idx" ON "ScrumAdmin"("userId");
CREATE INDEX "ScrumAdmin_assignedById_idx" ON "ScrumAdmin"("assignedById");
CREATE INDEX "Project_scrumId_idx" ON "Project"("scrumId");
CREATE INDEX "SprintProject_projectId_idx" ON "SprintProject"("projectId");

-- AddForeignKey
ALTER TABLE "ScrumAdmin" ADD CONSTRAINT "ScrumAdmin_scrumId_fkey" FOREIGN KEY ("scrumId") REFERENCES "Scrum"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScrumAdmin" ADD CONSTRAINT "ScrumAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScrumAdmin" ADD CONSTRAINT "ScrumAdmin_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Project" ADD CONSTRAINT "Project_scrumId_fkey" FOREIGN KEY ("scrumId") REFERENCES "Scrum"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SprintProject" ADD CONSTRAINT "SprintProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

