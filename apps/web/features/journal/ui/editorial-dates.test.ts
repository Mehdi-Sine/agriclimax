import { describe, it, expect } from "vitest";
import {
  frenchDate,
  frenchPeriod,
  frenchCycle,
  editorialText,
} from "./editorial-dates";
describe("French editorial dates, UTC display only", () => {
  it.each([
    ["2026-11-08", "2026-11-14", "du 8 au 14 novembre 2026"],
    ["2026-10-30", "2026-11-04", "du 30 octobre au 4 novembre 2026"],
    ["2026-12-30", "2027-01-03", "du 30 décembre 2026 au 3 janvier 2027"],
    ["2026-11-08", "2026-11-08", "le 8 novembre 2026"],
  ])("formats %s to %s", (a, b, expected) =>
    expect(frenchPeriod(a, b)).toBe(expected),
  );
  it("formats the edition and cycle hour without local timezone shift", () => {
    expect(frenchDate("2026-11-08")).toBe("8 novembre 2026");
    expect(frenchCycle("2026-11-07T00:00:00+00:00")).toBe(
      "7 novembre 2026, 00 h UTC",
    );
    expect(frenchCycle("2026-11-07T06:00:00Z")).toContain("06 h UTC");
  });
  it("transforms inherited factual prose without mutating structured input", () => {
    const fact = {
      text: "Gel prévu du 2026-11-08 au 2026-11-14, cycle 2026-11-07T00:00:00+00:00.",
      href: "/veille?cycle=2026-11-07T00:00:00Z",
      period: ["2026-11-08", "2026-11-14"],
    };
    expect(editorialText(fact.text)).toBe(
      "Gel prévu du 8 au 14 novembre 2026, cycle 7 novembre 2026, 00 h UTC.",
    );
    expect(fact.href).toContain("2026-11-07");
    expect(fact.period[0]).toBe("2026-11-08");
  });
});
