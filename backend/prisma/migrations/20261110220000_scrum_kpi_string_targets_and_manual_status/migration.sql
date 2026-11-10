DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'KpiStatus') THEN
    CREATE TYPE "KpiStatus" AS ENUM ('BELOW_MIN', 'IN_RANGE', 'ON_TARGET');
  END IF;
END $$;

ALTER TABLE "ScrumKpi" ADD COLUMN IF NOT EXISTS "finalTarget" TEXT;

DO $$
DECLARE
  v_has_progress BOOLEAN;
  v_has_status BOOLEAN;
  v_target_type TEXT;
  v_first_month_type TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ScrumKpi' AND column_name = 'progressPercent'
  ) INTO v_has_progress;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ScrumKpi' AND column_name = 'status'
  ) INTO v_has_status;

  SELECT data_type INTO v_target_type
  FROM information_schema.columns
  WHERE table_name = 'ScrumKpi' AND column_name = 'target';

  IF NOT v_has_progress THEN
    ALTER TABLE "ScrumKpi" ADD COLUMN "progressPercent" DECIMAL(5,2);
  END IF;

  IF NOT v_has_status THEN
    ALTER TABLE "ScrumKpi" ADD COLUMN "status" "KpiStatus";
  END IF;

  -- Backfill once from legacy numeric target/actualValue/minExpected before converting target to TEXT
  IF (NOT v_has_progress OR NOT v_has_status) AND v_target_type IS NOT NULL AND v_target_type <> 'text' THEN
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

  IF v_target_type IS NOT NULL AND v_target_type <> 'text' THEN
    ALTER TABLE "ScrumKpi"
      ALTER COLUMN "target" TYPE TEXT
      USING CASE
        WHEN "target" IS NULL THEN NULL
        WHEN "target"::text ~ '\.' THEN REGEXP_REPLACE(REGEXP_REPLACE("target"::text, '0+$', ''), '\.$', '')
        ELSE "target"::text
      END;
  END IF;

  SELECT data_type INTO v_first_month_type
  FROM information_schema.columns
  WHERE table_name = 'ScrumKpi' AND column_name = 'firstMonthTarget';

  IF v_first_month_type IS NOT NULL AND v_first_month_type <> 'text' THEN
    ALTER TABLE "ScrumKpi"
      ALTER COLUMN "firstMonthTarget" TYPE TEXT
      USING CASE
        WHEN "firstMonthTarget" IS NULL THEN NULL
        WHEN "firstMonthTarget"::text ~ '\.' THEN REGEXP_REPLACE(REGEXP_REPLACE("firstMonthTarget"::text, '0+$', ''), '\.$', '')
        ELSE "firstMonthTarget"::text
      END;
  END IF;
END $$;

