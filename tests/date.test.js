import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  todayDate,
  toDateOnly,
  formatDate,
  addDays,
  datesBetween,
  minutesSinceMidnight,
  isIsoDateString,
  getTimezoneParts,
} from "../Utils/date.js";

describe("Utils/date.js Tests", () => {
  const tehranTz = "Asia/Tehran";

  test("todayDate returns UTC midnight Date for timezone calendar date", () => {
    // 2026-11-01 20:30 UTC is 2026-11-02 00:00 in Tehran (+3:30)
    const fixedNow = new Date("2026-11-01T20:30:00.000Z");
    const d = todayDate(fixedNow, tehranTz);

    assert.equal(d.getUTCFullYear(), 2026);
    assert.equal(d.getUTCMonth(), 10); // November (0-indexed = 10)
    assert.equal(d.getUTCDate(), 2);
    assert.equal(d.getUTCHours(), 0);
    assert.equal(d.getUTCMinutes(), 0);
  });

  test("Timezone boundary test: 23:59 vs 00:00 transition in Asia/Tehran", () => {
    // Tehran is UTC+3:30.
    // 2026-06-10 20:29:50 UTC = 2026-06-10 23:59:50 Tehran
    const beforeMidnight = new Date("2026-06-10T20:29:50.000Z");
    const dateBefore = todayDate(beforeMidnight, tehranTz);
    assert.equal(formatDate(dateBefore), "2026-06-10");
    assert.equal(minutesSinceMidnight(beforeMidnight, tehranTz), 23 * 60 + 59);

    // 2026-06-10 20:30:05 UTC = 2026-06-11 00:00:05 Tehran
    const afterMidnight = new Date("2026-06-10T20:30:05.000Z");
    const dateAfter = todayDate(afterMidnight, tehranTz);
    assert.equal(formatDate(dateAfter), "2026-06-11");
    assert.equal(minutesSinceMidnight(afterMidnight, tehranTz), 0);
  });

  test("toDateOnly parses valid YYYY-MM-DD string into UTC midnight Date", () => {
    const d = toDateOnly("2026-05-15");
    assert.equal(d.toISOString(), "2026-05-15T00:00:00.000Z");
  });

  test("toDateOnly rejects invalid calendar dates", () => {
    assert.throws(() => toDateOnly("2026-02-30"), /Invalid calendar date/);
    assert.throws(() => toDateOnly("not-a-date"), /Invalid date format/);
    assert.throws(() => toDateOnly("2026-13-01"), /Invalid calendar date/);
  });

  test("formatDate correctly formats date-only Date objects", () => {
    const d = new Date(Date.UTC(2026, 3, 9));
    assert.equal(formatDate(d), "2026-04-09");
  });

  test("addDays correctly increments and decrements days across month/year boundaries", () => {
    const dec31 = new Date(Date.UTC(2025, 11, 31));
    const jan1 = addDays(dec31, 1);
    assert.equal(formatDate(jan1), "2026-01-01");

    const janMinus1 = addDays(jan1, -1);
    assert.equal(formatDate(janMinus1), "2025-12-31");
  });

  test("datesBetween generates inclusive sequence of calendar days", () => {
    const start = "2026-03-29";
    const end = "2026-04-02";
    const list = datesBetween(start, end);
    assert.equal(list.length, 5);
    assert.equal(formatDate(list[0]), "2026-03-29");
    assert.equal(formatDate(list[1]), "2026-03-30");
    assert.equal(formatDate(list[2]), "2026-03-31");
    assert.equal(formatDate(list[3]), "2026-04-01");
    assert.equal(formatDate(list[4]), "2026-04-02");
  });

  test("isIsoDateString validates correctly", () => {
    assert.equal(isIsoDateString("2026-01-15"), true);
    assert.equal(isIsoDateString("2026-02-29"), false); // 2026 is not a leap year
    assert.equal(isIsoDateString("invalid"), false);
    assert.equal(isIsoDateString(null), false);
  });
});
