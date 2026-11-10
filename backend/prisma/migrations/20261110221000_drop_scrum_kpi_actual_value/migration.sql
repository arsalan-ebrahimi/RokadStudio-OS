-- Drop legacy numeric actualValue column from ScrumKpi
ALTER TABLE "ScrumKpi" DROP COLUMN IF EXISTS "actualValue";

