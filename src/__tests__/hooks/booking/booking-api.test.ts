import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchBookings,
  fetchBookingById,
  createBookingApi,
  updateBookingApi,
  deleteBookingApi,
  performBookingAction,
} from "@/hooks/booking/booking-api";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("booking-api", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("fetchBookings", () => {
    it("GETs /api/bookings and returns the parsed list", async () => {
      const bookings = [{ id: "b1" }, { id: "b2" }];
      fetchSpy.mockResolvedValueOnce(jsonResponse(bookings));

      const result = await fetchBookings();

      expect(fetchSpy).toHaveBeenCalledWith("/api/bookings");
      expect(result).toEqual(bookings);
    });

    it("throws a plain Error when the response is not ok", async () => {
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 500 }));
      await expect(fetchBookings()).rejects.toThrow("Failed to fetch bookings");
    });
  });

  describe("fetchBookingById", () => {
    it("GETs /api/bookings/:id and returns the parsed booking", async () => {
      const booking = { id: "b1" };
      fetchSpy.mockResolvedValueOnce(jsonResponse(booking));

      const result = await fetchBookingById("b1");

      expect(fetchSpy).toHaveBeenCalledWith("/api/bookings/b1");
      expect(result).toEqual(booking);
    });

    it("surfaces the server's error message on failure", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ error: "Booking not found" }, 404),
      );
      await expect(fetchBookingById("missing")).rejects.toThrow(
        "Booking not found",
      );
    });

    it("falls back to a default message when the error body is unparsable", async () => {
      fetchSpy.mockResolvedValueOnce(new Response("not json", { status: 500 }));
      await expect(fetchBookingById("b1")).rejects.toThrow(
        "Failed to fetch booking",
      );
    });
  });

  describe("createBookingApi", () => {
    it("POSTs to /api/bookings with the payload and returns the created booking", async () => {
      const data = { roomId: "r1", guestName: "Alice" };
      const created = { id: "b1", ...data };
      fetchSpy.mockResolvedValueOnce(jsonResponse(created, 201));

      // @ts-expect-error - partial payload is sufficient for this test
      const result = await createBookingApi(data);

      expect(fetchSpy).toHaveBeenCalledWith("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      expect(result).toEqual(created);
    });

    it("surfaces the server's error message on failure", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ error: "Room is unavailable" }, 409),
      );
      // @ts-expect-error - partial payload is sufficient for this test
      await expect(createBookingApi({})).rejects.toThrow("Room is unavailable");
    });

    it("propagates network errors", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("network down"));
      // @ts-expect-error - partial payload is sufficient for this test
      await expect(createBookingApi({})).rejects.toThrow("network down");
    });
  });

  describe("updateBookingApi", () => {
    it("PUTs to /api/bookings/:id with the payload and returns the updated booking", async () => {
      const data = { guestName: "Bob" };
      const updated = { id: "b1", ...data };
      fetchSpy.mockResolvedValueOnce(jsonResponse(updated));

      const result = await updateBookingApi({ id: "b1", data });

      expect(fetchSpy).toHaveBeenCalledWith("/api/bookings/b1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      expect(result).toEqual(updated);
    });

    it("surfaces the server's error message on failure", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ error: "Validation failed" }, 400),
      );
      await expect(
        updateBookingApi({ id: "b1", data: {} }),
      ).rejects.toThrow("Validation failed");
    });
  });

  describe("deleteBookingApi", () => {
    it("DELETEs /api/bookings/:id and returns the response body", async () => {
      const body = { deleted: true, message: "Booking deleted" };
      fetchSpy.mockResolvedValueOnce(jsonResponse(body));

      const result = await deleteBookingApi("b1");

      expect(fetchSpy).toHaveBeenCalledWith("/api/bookings/b1", {
        method: "DELETE",
      });
      expect(result).toEqual(body);
    });

    it("surfaces the server's error message on failure", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ error: "Only managers can delete bookings" }, 403),
      );
      await expect(deleteBookingApi("b1")).rejects.toThrow(
        "Only managers can delete bookings",
      );
    });
  });

  describe("performBookingAction", () => {
    it("PATCHes /api/bookings/:id with the action and reason", async () => {
      const updated = { id: "b1", status: "CANCELLED" };
      fetchSpy.mockResolvedValueOnce(jsonResponse(updated));

      const result = await performBookingAction({
        id: "b1",
        action: "cancel",
        reason: "Guest requested",
      });

      expect(fetchSpy).toHaveBeenCalledWith("/api/bookings/b1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", reason: "Guest requested" }),
      });
      expect(result).toEqual(updated);
    });

    it("surfaces an action-specific default error message on failure", async () => {
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 500 }));
      await expect(
        performBookingAction({ id: "b1", action: "check-in" }),
      ).rejects.toThrow("Failed to check-in");
    });
  });
});
