import { describe, it, expect } from "vitest";
import { formatDisplayDate, formatDisplayTime } from "@/lib/utils/format-date";

describe("formatDisplayDate", () => {
  it("returns the empty placeholder for an empty string", () => {
    expect(formatDisplayDate("")).toBe("___/___/______");
  });

  it("formats an ISO date string as dd/MM/yyyy", () => {
    expect(formatDisplayDate("2026-05-01")).toBe("01/05/2026");
  });

  it("zero-pads single-digit day and month", () => {
    expect(formatDisplayDate("2026-01-09")).toBe("09/01/2026");
  });
});

describe("formatDisplayTime", () => {
  it("returns the empty placeholder for an empty string", () => {
    expect(formatDisplayTime("")).toBe("______");
  });

  it("formats midnight as 12:00 AM", () => {
    expect(formatDisplayTime("00:00")).toBe("12:00 AM");
  });

  it("formats noon as 12:00 PM", () => {
    expect(formatDisplayTime("12:00")).toBe("12:00 PM");
  });

  it("formats an afternoon time with AM/PM conversion", () => {
    expect(formatDisplayTime("14:30")).toBe("2:30 PM");
  });

  it("formats an early-morning time", () => {
    expect(formatDisplayTime("06:15")).toBe("6:15 AM");
  });
});
