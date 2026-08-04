import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetServerSession = vi.fn();
const mockGetCalendarEvents = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

vi.mock("@/lib/services/calendar-service", () => ({
  getCalendarEvents: (...args: unknown[]) => mockGetCalendarEvents(...args),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { GET } from "@/app/api/calendar/route";

describe("Calendar API", () => {
  const session = {
    user: { id: "u-1", email: "s@example.com", role: "STAFF" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await GET(new NextRequest("http://localhost/api/calendar"));

    expect(response.status).toBe(401);
    expect(mockGetCalendarEvents).not.toHaveBeenCalled();
  });

  it("calls the service with no filters when no params", async () => {
    mockGetServerSession.mockResolvedValue(session);
    mockGetCalendarEvents.mockResolvedValue([]);

    const response = await GET(new NextRequest("http://localhost/api/calendar"));

    expect(response.status).toBe(200);
    expect(mockGetCalendarEvents).toHaveBeenCalledWith(
      undefined,
      undefined,
      undefined,
    );
  });

  it("parses start/end into Date objects and forwards roomId", async () => {
    mockGetServerSession.mockResolvedValue(session);
    mockGetCalendarEvents.mockResolvedValue([]);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/calendar?start=2026-05-01&end=2026-05-31&roomId=room-9",
      ),
    );

    expect(response.status).toBe(200);
    const [startArg, endArg, roomArg] = mockGetCalendarEvents.mock.calls[0];
    expect(startArg).toBeInstanceOf(Date);
    expect(endArg).toBeInstanceOf(Date);
    expect((startArg as Date).toISOString()).toBe("2026-05-01T00:00:00.000Z");
    expect((endArg as Date).toISOString()).toBe("2026-05-31T00:00:00.000Z");
    expect(roomArg).toBe("room-9");
  });

  it("returns 400 when start is not a parseable date", async () => {
    mockGetServerSession.mockResolvedValue(session);

    const response = await GET(
      new NextRequest("http://localhost/api/calendar?start=not-a-date"),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("VALIDATION_ERROR");
    expect(mockGetCalendarEvents).not.toHaveBeenCalled();
  });
});
