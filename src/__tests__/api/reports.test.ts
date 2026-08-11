import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetServerSession = vi.fn();
const mockGetRoomPerformance = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

vi.mock("@/lib/services/report", () => ({
  getRoomPerformance: (...args: unknown[]) => mockGetRoomPerformance(...args),
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

import { GET } from "@/app/api/reports/route";

describe("Reports API", () => {
  const mockStaffSession = {
    user: { id: "user-1", email: "staff@example.com", role: "STAFF" },
  };
  const mockManagerSession = {
    user: { id: "user-2", email: "manager@example.com", role: "MANAGER" },
  };

  const buildRequest = (search = "") =>
    new Request(`http://localhost/api/reports${search}`);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/reports", () => {
    it("returns 401 when not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await GET(buildRequest());
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe("UNAUTHORIZED");
      expect(mockGetRoomPerformance).not.toHaveBeenCalled();
    });

    it("returns 403 when authenticated user is STAFF", async () => {
      mockGetServerSession.mockResolvedValue(mockStaffSession);

      const response = await GET(buildRequest());
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
      expect(mockGetRoomPerformance).not.toHaveBeenCalled();
    });

    it("passes parsed start/end dates to room performance report", async () => {
      mockGetServerSession.mockResolvedValue(mockManagerSession);
      mockGetRoomPerformance.mockResolvedValue([]);

      const response = await GET(
        buildRequest("?type=rooms&startDate=2026-01-01&endDate=2026-01-31"),
      );

      expect(response.status).toBe(200);
      expect(mockGetRoomPerformance).toHaveBeenCalledWith(
        new Date("2026-01-01"),
        new Date("2026-01-31"),
      );
    });

    it("returns 400 when rooms report is given an unparseable startDate", async () => {
      mockGetServerSession.mockResolvedValue(mockManagerSession);

      const response = await GET(
        buildRequest("?type=rooms&startDate=not-a-date"),
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
      expect(mockGetRoomPerformance).not.toHaveBeenCalled();
    });

    it("calls room performance with undefined dates when omitted (default type)", async () => {
      mockGetServerSession.mockResolvedValue(mockManagerSession);
      mockGetRoomPerformance.mockResolvedValue([]);

      const response = await GET(buildRequest());

      expect(response.status).toBe(200);
      expect(mockGetRoomPerformance).toHaveBeenCalledWith(undefined, undefined);
    });

    it("handles service errors", async () => {
      mockGetServerSession.mockResolvedValue(mockManagerSession);
      mockGetRoomPerformance.mockRejectedValue(new Error("Database error"));

      const response = await GET(buildRequest("?type=rooms"));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe("INTERNAL_ERROR");
    });
  });
});
