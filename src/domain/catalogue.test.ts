import { describe, expect, it } from "vitest";
import { defaultDateRange } from "./catalogue";
import { fixtureClock } from "./fixtures";

describe("the catalogue's default date range", () => {
  it("starts at the fixture clock and runs for thirty days", () => {
    expect(defaultDateRange(fixtureClock)).toEqual({
      startDate: "2027-01-15",
      endDate: "2027-02-14",
    });
  });

  it("never derives a range from the real clock", () => {
    const range = defaultDateRange(fixtureClock);

    expect(range.startDate.startsWith("2027")).toBe(true);
    expect(range).not.toEqual(defaultDateRange(new Date()));
  });
});
