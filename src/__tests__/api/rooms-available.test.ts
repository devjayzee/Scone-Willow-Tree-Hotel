import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetServerSession = vi.fn();
const mockGetAvailableRooms = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

vi.mock("@/lib/services/room-service", () => ({
  getAvailableRooms: (...args: unknown[]) => mockGetAvailableRooms(...args),
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

import { GET } from "@/app/api/rooms/available/route";

describe("Rooms Available API", () => {
  const session = {
    user: { id: "u-1", email: "s@example.com", role: "STAFF" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost/api/rooms/available?checkIn=2026-05-01&checkOut=2026-05-05",
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(mockGetAvailableRooms).not.toHaveBeenCalled();
  });

  it("returns 400 when checkIn or checkOut is missing", async () => {
    mockGetServerSession.mockResolvedValue(session);

    const request = new NextRequest("http://localhost/api/rooms/available");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("VALIDATION_ERROR");
    expect(mockGetAvailableRooms).not.toHaveBeenCalled();
  });

  it("returns 400 when checkIn is not a parseable date", async () => {
    mockGetServerSession.mockResolvedValue(session);

    const request = new NextRequest(
      "http://localhost/api/rooms/available?checkIn=nope&checkOut=2026-05-05",
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("VALIDATION_ERROR");
    expect(mockGetAvailableRooms).not.toHaveBeenCalled();
  });

  it("returns 400 when checkOut is not after checkIn", async () => {
    mockGetServerSession.mockResolvedValue(session);

    const request = new NextRequest(
      "http://localhost/api/rooms/available?checkIn=2026-05-05&checkOut=2026-05-05",
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("VALIDATION_ERROR");
    expect(mockGetAvailableRooms).not.toHaveBeenCalled();
  });

  it("calls the service with parsed Date objects on success", async () => {
    mockGetServerSession.mockResolvedValue(session);
    mockGetAvailableRooms.mockResolvedValue([{ id: "room-1" }]);

    const request = new NextRequest(
      "http://localhost/api/rooms/available?checkIn=2026-05-01&checkOut=2026-05-05",
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([{ id: "room-1" }]);
    expect(mockGetAvailableRooms).toHaveBeenCalledWith(
      expect.any(Date),
      expect.any(Date),
    );
    const [checkInArg, checkOutArg] = mockGetAvailableRooms.mock.calls[0];
    expect((checkInArg as Date).toISOString()).toBe("2026-05-01T00:00:00.000Z");
    expect((checkOutArg as Date).toISOString()).toBe("2026-05-05T00:00:00.000Z");
  });
});
