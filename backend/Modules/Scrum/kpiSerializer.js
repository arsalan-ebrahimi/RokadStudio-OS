const VALID_KPI_STATUSES = new Set(["BELOW_MIN", "IN_RANGE", "ON_TARGET"]);

const normalizeNullableText = (val) => {
  if (typeof val !== "string") return null;
  return val.trim() === "" ? null : val;
};

/**
 * Serializes KPI rows according to caller role.
 * For plain members, `minExpected` is omitted entirely from the object.
 */
export const serializeKpiRow = (kpi, isAdmin = false) => {
  const actualValue = kpi.actualValue != null ? Number(kpi.actualValue) : null;
  const minExpected = kpi.minExpected != null ? Number(kpi.minExpected) : null;
  const rawProgress = kpi.progressPercent != null ? Number(kpi.progressPercent) : null;
  const progressPercent =
    rawProgress !== null && Number.isFinite(rawProgress)
      ? Math.round(rawProgress * 100) / 100
      : null;
  const status = VALID_KPI_STATUSES.has(kpi.status) ? kpi.status : null;

  const base = {
    id: kpi.id,
    scrumId: kpi.scrumId,
    indicator: normalizeNullableText(kpi.indicator),
    formula: normalizeNullableText(kpi.formula),
    strategicGoal: normalizeNullableText(kpi.strategicGoal),
    unit: normalizeNullableText(kpi.unit),
    target: normalizeNullableText(kpi.target),
    firstMonthTarget: normalizeNullableText(kpi.firstMonthTarget),
    finalTarget: normalizeNullableText(kpi.finalTarget),
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
