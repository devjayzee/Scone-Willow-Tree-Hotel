import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatDisplayDate,
  formatDisplayTime,
  getLogoBase64,
} from "@/lib/utils/pdf/booking-registration/pdf-helpers";

describe("formatDisplayDate", () => {
  it("formats an ISO datetime string as dd/MM/yyyy", () => {
    expect(formatDisplayDate("2026-05-01T14:30:00.000Z")).toBe("01/05/2026");
  });

  it("formats a date-only string as dd/MM/yyyy", () => {
    expect(formatDisplayDate("2026-12-25")).toBe("25/12/2026");
  });

  it("returns empty string for empty input", () => {
    expect(formatDisplayDate("")).toBe("");
  });

  it("falls back to the raw string on parse failure", () => {
    expect(formatDisplayDate("not-a-date")).toBe("not-a-date");
  });
});

describe("formatDisplayTime", () => {
  it("converts 24h to 12h AM/PM", () => {
    expect(formatDisplayTime("13:30")).toBe("1:30 PM");
    expect(formatDisplayTime("09:15")).toBe("9:15 AM");
  });

  it("renders midnight as 12:00 AM", () => {
    expect(formatDisplayTime("00:00")).toBe("12:00 AM");
  });

  it("renders noon as 12:00 PM", () => {
    expect(formatDisplayTime("12:00")).toBe("12:00 PM");
  });

  it("returns empty string for null / undefined / empty", () => {
    expect(formatDisplayTime(null)).toBe("");
    expect(formatDisplayTime(undefined)).toBe("");
    expect(formatDisplayTime("")).toBe("");
  });
});

describe("getLogoBase64", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
  });

  it("returns a base64 data URL when fetch + FileReader succeed", async () => {
    const fakeBlob = new Blob(["logo-bytes"], { type: "image/png" });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      blob: async () => fakeBlob,
    });

    const result = await getLogoBase64();

    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it("returns null when fetch throws (missing logo, offline, etc.)", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("network error"),
    );

    const result = await getLogoBase64();

    expect(result).toBeNull();
  });

  it("cache-busts with a timestamp query string", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      blob: async () => new Blob(["x"], { type: "image/png" }),
    });

    await getLogoBase64();

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toMatch(/^\/logo\.png\?v=\d+$/);
  });
});
