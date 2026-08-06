import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetServerSession = vi.fn();
const mockGetBookingById = vi.fn();
const mockUpdateBooking = vi.fn();
const mockDeleteBooking = vi.fn();
const mockApplyBookingAction = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

vi.mock("@/lib/services/booking", () => ({
  getBookingById: (...args: unknown[]) => mockGetBookingById(...args),
  updateBooking: (...args: unknown[]) => mockUpdateBooking(...args),
  deleteBooking: (...args: unknown[]) => mockDeleteBooking(...args),
  applyBookingAction: (...args: unknown[]) => mockApplyBookingAction(...args),
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

import { GET, PUT, PATCH, DELETE } from "@/app/api/bookings/[id]/route";

const params = Promise.resolve({ id: "booking-1" });

describe("Bookings [id] API", () => {
  const staffSession = {
    user: { id: "u-staff", email: "s@example.com", role: "STAFF" },
  };
  const managerSession = {
    user: { id: "u-mgr", email: "m@example.com", role: "MANAGER" },
  };
  const gmSession = {
    user: { id: "u-gm", email: "gm@example.com", role: "GENERAL_MANAGER" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/bookings/[id]", () => {
    const req = new Request("http://localhost/api/bookings/booking-1");

    it("returns 401 when not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await GET(req, { params });

      expect(response.status).toBe(401);
      expect(mockGetBookingById).not.toHaveBeenCalled();
    });

    it("returns booking for any authenticated user (STAFF ok)", async () => {
      mockGetServerSession.mockResolvedValue(staffSession);
      mockGetBookingById.mockResolvedValue({ id: "booking-1" });

      const response = await GET(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe("booking-1");
    });
  });

  describe("PUT /api/bookings/[id]", () => {
    const buildRequest = (body: unknown) =>
      new NextRequest("http://localhost/api/bookings/booking-1", {
        method: "PUT",
        body: JSON.stringify(body),
      });

    it("returns 401 when not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await PUT(buildRequest({}), { params });

      expect(response.status).toBe(401);
      expect(mockUpdateBooking).not.toHaveBeenCalled();
    });

    it("allows STAFF to update (no role gate on PUT)", async () => {
      mockGetServerSession.mockResolvedValue(staffSession);
      mockUpdateBooking.mockResolvedValue({ id: "booking-1" });

      const response = await PUT(buildRequest({ guestName: "New Guest" }), {
        params,
      });

      expect(response.status).toBe(200);
      expect(mockUpdateBooking).toHaveBeenCalledWith(
        "booking-1",
        expect.objectContaining({ guestName: "New Guest" }),
        staffSession.user.id,
      );
    });
  });

  describe("PATCH /api/bookings/[id] — action dispatch", () => {
    const buildRequest = (body: unknown) =>
      new NextRequest("http://localhost/api/bookings/booking-1", {
        method: "PATCH",
        body: JSON.stringify(body),
      });

    it("returns 401 when not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await PATCH(buildRequest({ action: "check-in" }), {
        params,
      });

      expect(response.status).toBe(401);
      expect(mockApplyBookingAction).not.toHaveBeenCalled();
    });

    // Per-variant dispatch semantics are proven in the service-level test
    // (`booking-mutations.test.ts::applyBookingAction`). Here we just
    // verify the handler forwards the parsed action to the dispatcher
    // for each of the six variants — that's all the route owns now.
    it.each([
      ["check-in", { action: "check-in" }],
      ["check-out", { action: "check-out" }],
      ["undo-checkout", { action: "undo-checkout" }],
      ["undo-cancel", { action: "undo-cancel" }],
      ["toggle-payment", { action: "toggle-payment" }],
      ["cancel with reason", { action: "cancel", reason: "guest no-show" }],
    ])("forwards %s to applyBookingAction", async (_label, body) => {
      mockGetServerSession.mockResolvedValue(staffSession);
      mockApplyBookingAction.mockResolvedValue({ id: "booking-1" });

      const response = await PATCH(buildRequest(body), { params });

      expect(response.status).toBe(200);
      expect(mockApplyBookingAction).toHaveBeenCalledWith(
        "booking-1",
        body,
        staffSession.user.id,
      );
    });

    it("forwards cancel without reason as { action: 'cancel' } (no reason key)", async () => {
      mockGetServerSession.mockResolvedValue(staffSession);
      mockApplyBookingAction.mockResolvedValue({ id: "booking-1", status: "CANCELLED" });

      const response = await PATCH(buildRequest({ action: "cancel" }), {
        params,
      });

      expect(response.status).toBe(200);
      expect(mockApplyBookingAction).toHaveBeenCalledWith(
        "booking-1",
        { action: "cancel" },
        staffSession.user.id,
      );
    });

    it("falls through to updateBooking when body has no action key (partial update)", async () => {
      mockGetServerSession.mockResolvedValue(staffSession);
      mockUpdateBooking.mockResolvedValue({ id: "booking-1", guestName: "Renamed" });

      const response = await PATCH(buildRequest({ guestName: "Renamed" }), {
        params,
      });

      expect(response.status).toBe(200);
      expect(mockUpdateBooking).toHaveBeenCalledWith(
        "booking-1",
        expect.objectContaining({ guestName: "Renamed" }),
        staffSession.user.id,
      );
      expect(mockApplyBookingAction).not.toHaveBeenCalled();
    });

    it("returns 400 for unknown action value", async () => {
      mockGetServerSession.mockResolvedValue(staffSession);

      const response = await PATCH(buildRequest({ action: "bogus" }), {
        params,
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
      expect(mockApplyBookingAction).not.toHaveBeenCalled();
      expect(mockUpdateBooking).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /api/bookings/[id]", () => {
    const req = new Request("http://localhost/api/bookings/booking-1", {
      method: "DELETE",
    });

    it("returns 401 when not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await DELETE(req, { params });

      expect(response.status).toBe(401);
      expect(mockDeleteBooking).not.toHaveBeenCalled();
    });

    it("returns 403 when user is STAFF", async () => {
      mockGetServerSession.mockResolvedValue(staffSession);

      const response = await DELETE(req, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
      expect(mockDeleteBooking).not.toHaveBeenCalled();
    });

    it("returns 403 when user is MANAGER (GM-only endpoint)", async () => {
      mockGetServerSession.mockResolvedValue(managerSession);

      const response = await DELETE(req, { params });

      expect(response.status).toBe(403);
      expect(mockDeleteBooking).not.toHaveBeenCalled();
    });

    it("deletes booking for GENERAL_MANAGER and threads currentUserId", async () => {
      mockGetServerSession.mockResolvedValue(gmSession);
      mockDeleteBooking.mockResolvedValue({
        deleted: true,
        message: "Booking deleted successfully",
      });

      const response = await DELETE(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.deleted).toBe(true);
      expect(mockDeleteBooking).toHaveBeenCalledWith("booking-1", gmSession.user.id);
    });
  });
});
