import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { serializeKpiRow, serializeKpiRows } from "../Modules/Scrum/kpiSerializer.js";
import {
  batchKpiBodyValidator,
  myTasksQueryValidator,
} from "../Modules/Scrum/scrumValidator.js";
import { buildWorkDateFilter } from "../Modules/Scrum/scrumExtendedService.js";
import { toDateOnly } from "../Utils/date.js";

/**
 * Runs an Express middleware array sequentially against mock req/res objects.
 */
async function runValidatorChain(middlewares, { body = {}, query = {}, params = {} } = {}) {
  const req = { body, query, params };
  let statusCode = 200;
  let jsonPayload = null;
  let nextCalled = false;

  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(payload) {
      jsonPayload = payload;
      return res;
    },
  };

  for (const mw of middlewares) {
    let settled = false;
    nextCalled = false;
    await new Promise((resolve, reject) => {
      const next = (err) => {
        if (err) {
          reject(err);
          return;
        }
        nextCalled = true;
        settled = true;
        resolve();
      };

      const maybePromise = mw(req, res, next);
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise
          .then(() => {
            if (!settled) resolve();
          })
          .catch(reject);
      } else if (!nextCalled && jsonPayload !== null) {
        settled = true;
        resolve();
      }
    });

    if (jsonPayload !== null || !nextCalled) {
      break;
    }
  }

  return { req, statusCode, jsonPayload, passed: nextCalled && jsonPayload === null };
}

describe("Scrum KPI Serializer Tests", () => {
  const sampleRow = {
    id: 12,
    scrumId: 3,
    indicator: "نرخ تبدیل",
    formula: "  تعداد خرید / کل لید * 100  ",
    strategicGoal: "افزایش فروش",
    unit: "درصد",
    firstMonthTarget: "0",
    target: "۷۵ درصد تا پایان فصل",
    finalTarget: "   ",
    minExpected: 0,
    progressPercent: 0,
    status: "IN_RANGE",
    sortOrder: 0,
    updatedAt: new Date("2026-11-10T10:00:00.000Z"),
  };

  test("serializes string targets (preserving '0'), whitespace -> null, manual progressPercent=0, omits minExpected for non-admins, and omits actualValue", () => {
    const memberRow = serializeKpiRow(sampleRow, false);

    assert.equal(memberRow.firstMonthTarget, "0");
    assert.equal(memberRow.target, "۷۵ درصد تا پایان فصل");
    assert.equal(memberRow.finalTarget, null);
    assert.equal(memberRow.progressPercent, 0);
    assert.equal(memberRow.status, "IN_RANGE");
    assert.equal(Object.hasOwn(memberRow, "minExpected"), false);
    assert.equal(Object.hasOwn(memberRow, "actualValue"), false);
  });

  test("includes minExpected (preserving 0) for admin callers and handles decimal rounding/invalid status", () => {
    const adminRows = serializeKpiRows(
      [
        sampleRow,
        {
          ...sampleRow,
          id: 13,
          finalTarget: "۱۰۰ درصد",
          progressPercent: 94.126,
          status: "UNKNOWN_VALUE",
          minExpected: 50,
        },
      ],
      true
    );

    assert.equal(Object.hasOwn(adminRows[0], "minExpected"), true);
    assert.equal(adminRows[0].minExpected, 0);
    assert.equal(adminRows[1].finalTarget, "۱۰۰ درصد");
    assert.equal(adminRows[1].progressPercent, 94.13);
    assert.equal(adminRows[1].status, null);
    assert.equal(adminRows[1].minExpected, 50);
  });
});

describe("Scrum KPI Batch Validator Tests", () => {
  test("accepts string targets, formula, manual progressPercent, and valid status", async () => {
    const result = await runValidatorChain(batchKpiBodyValidator, {
      body: {
        rows: [
          {
            id: 1,
            indicator: "نرخ رشد",
            formula: "A / B * 100",
            strategicGoal: "رشد ماهانه",
            firstMonthTarget: "۷۰ درصد",
            target: "۸۵ درصد",
            finalTarget: "۱۰۰ درصد",
            progressPercent: 94.5,
            status: "ON_TARGET",
            minExpected: 60,
          },
          {
            indicator: "شاخص صفر",
            firstMonthTarget: "0",
            target: "",
            finalTarget: null,
            progressPercent: 0,
            status: null,
          },
          {
            indicator: "شاخص بازه",
            progressPercent: 100,
            status: "",
          },
        ],
      },
    });

    assert.equal(result.passed, true);
    assert.equal(result.statusCode, 200);
  });

  test("rejects non-string targets (e.g. number for finalTarget/target)", async () => {
    const resTarget = await runValidatorChain(batchKpiBodyValidator, {
      body: { rows: [{ indicator: "X", target: 85 }] },
    });
    assert.equal(resTarget.passed, false);
    assert.equal(resTarget.statusCode, 400);

    const resFinal = await runValidatorChain(batchKpiBodyValidator, {
      body: { rows: [{ indicator: "X", finalTarget: 100 }] },
    });
    assert.equal(resFinal.passed, false);
    assert.equal(resFinal.statusCode, 400);
  });

  test("rejects out-of-range progressPercent, invalid status enum, and unknown keys", async () => {
    const resNeg = await runValidatorChain(batchKpiBodyValidator, {
      body: { rows: [{ indicator: "X", progressPercent: -1 }] },
    });
    assert.equal(resNeg.passed, false);
    assert.equal(resNeg.statusCode, 400);

    const resOver = await runValidatorChain(batchKpiBodyValidator, {
      body: { rows: [{ indicator: "X", progressPercent: 100.5 }] },
    });
    assert.equal(resOver.passed, false);
    assert.equal(resOver.statusCode, 400);

    const resStatus = await runValidatorChain(batchKpiBodyValidator, {
      body: { rows: [{ indicator: "X", status: "COMPLETED" }] },
    });
    assert.equal(resStatus.passed, false);
    assert.equal(resStatus.statusCode, 400);

    const resUnknown = await runValidatorChain(batchKpiBodyValidator, {
      body: { rows: [{ indicator: "X", unknownCol: "bad" }] },
    });
    assert.equal(resUnknown.passed, false);
    assert.equal(resUnknown.statusCode, 400);

    const resRemovedActual = await runValidatorChain(batchKpiBodyValidator, {
      body: { rows: [{ indicator: "X", actualValue: 50 }] },
    });
    assert.equal(resRemovedActual.passed, false);
    assert.equal(resRemovedActual.statusCode, 400);
  });
});

describe("My Scrum Tasks Date Filter & Validator Tests", () => {
  test("buildWorkDateFilter builds exact date, range, or undefined", () => {
    const exact = buildWorkDateFilter({ date: "2026-11-10" });
    assert.deepEqual(exact, toDateOnly("2026-11-10"));

    const range = buildWorkDateFilter({ dateFrom: "2026-11-01", dateTo: "2026-11-10" });
    assert.deepEqual(range, {
      gte: toDateOnly("2026-11-01"),
      lte: toDateOnly("2026-11-10"),
    });

    const partialFrom = buildWorkDateFilter({ dateFrom: "2026-11-01" });
    assert.deepEqual(partialFrom, { gte: toDateOnly("2026-11-01") });

    assert.equal(buildWorkDateFilter({}), undefined);
    assert.equal(buildWorkDateFilter({ date: "   ", dateFrom: "", dateTo: "" }), undefined);
  });

  test("myTasksQueryValidator accepts valid filters and parses types", async () => {
    const result = await runValidatorChain(myTasksQueryValidator, {
      query: {
        scrumId: "5",
        isActive: "true",
        search: "  طراحی  ",
        dateFrom: "2026-11-01",
        dateTo: "2026-11-10",
      },
    });

    assert.equal(result.passed, true);
    assert.equal(result.req.validatedQuery.scrumId, 5);
    assert.equal(result.req.validatedQuery.isActive, true);
    assert.equal(result.req.validatedQuery.search, "طراحی");
    assert.equal(result.req.validatedQuery.dateFrom, "2026-11-01");
    assert.equal(result.req.validatedQuery.dateTo, "2026-11-10");
  });

  test("myTasksQueryValidator rejects inverted date range, invalid date, and unknown query params", async () => {
    const inverted = await runValidatorChain(myTasksQueryValidator, {
      query: {
        dateFrom: "2026-11-15",
        dateTo: "2026-11-10",
      },
    });
    assert.equal(inverted.passed, false);
    assert.equal(inverted.statusCode, 400);

    const invalidDate = await runValidatorChain(myTasksQueryValidator, {
      query: {
        date: "2026-02-30",
      },
    });
    assert.equal(invalidDate.passed, false);
    assert.equal(invalidDate.statusCode, 400);

    const unknownQuery = await runValidatorChain(myTasksQueryValidator, {
      query: {
        scrumId: "2",
        foo: "bar",
      },
    });
    assert.equal(unknownQuery.passed, false);
    assert.equal(unknownQuery.statusCode, 400);
  });
});

