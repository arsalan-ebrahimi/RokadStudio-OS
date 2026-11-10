/**
 * Serializes KPI rows according to caller role.
 * For plain members, `minExpected` is omitted entirely from the object.
 */
export const serializeKpiRow = (kpi, isAdmin = false) => {
  const target = kpi.target != null ? Number(kpi.target) : null;
  const firstMonthTarget = kpi.firstMonthTarget != null ? Number(kpi.firstMonthTarget) : null;
  const actualValue = kpi.actualValue != null ? Number(kpi.actualValue) : null;
  const minExpected = kpi.minExpected != null ? Number(kpi.minExpected) : null;

  let progressPercent = null;
  if (target != null && actualValue != null && Number.isFinite(target) && Number.isFinite(actualValue) && target !== 0) {
    progressPercent = Math.round((actualValue / target) * 10000) / 100;
  }

  let status = null;
  if (actualValue != null && target != null) {
    if (minExpected != null && actualValue < minExpected) {
      status = "BELOW_MIN";
    } else if (actualValue >= target) {
      status = "ON_TARGET";
    } else {
      status = "IN_RANGE";
    }
  }

  const base = {
    id: kpi.id,
    scrumId: kpi.scrumId,
    indicator: kpi.indicator || null,
    formula: kpi.formula || null,
    strategicGoal: kpi.strategicGoal || null,
    unit: kpi.unit || null,
    target,
    firstMonthTarget,
    actualValue,
    sortOrder: kpi.sortOrder,
    updatedAt: kpi.updatedAt,
    progressPercent,
    status,
  };

  if (isAdmin) {
    return {
      ...base,
      minExpected,
    };
  }

  // Ensure minExpected key does not exist on the returned object
  return base;
};

export const serializeKpiRows = (rows, isAdmin = false) => {
  return rows.map((r) => serializeKpiRow(r, isAdmin));
};
