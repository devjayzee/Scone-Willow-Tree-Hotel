import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchRooms,
  fetchAvailableRooms,
  createRoom,
  updateRoom,
  deleteRoom,
} from "@/hooks/room/room-api";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("room-api", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("fetchRooms", () => {
    it("GETs /api/rooms and returns the parsed list", async () => {
      const rooms = [{ id: "r1" }, { id: "r2" }];
      fetchSpy.mockResolvedValueOnce(jsonResponse(rooms));

      const result = await fetchRooms();

      expect(fetchSpy).toHaveBeenCalledWith("/api/rooms");
      expect(result).toEqual(rooms);
    });

    it("throws a plain Error when the response is not ok", async () => {
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 500 }));
      await expect(fetchRooms()).rejects.toThrow("Failed to fetch rooms");
    });
  });

  describe("fetchAvailableRooms", () => {
    it("GETs /api/rooms/available with the date range query params", async () => {
      const rooms = [{ id: "r1" }];
      fetchSpy.mockResolvedValueOnce(jsonResponse(rooms));

      const result = await fetchAvailableRooms("2026-09-01", "2026-09-05");

      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/rooms/available?checkIn=2026-09-01&checkOut=2026-09-05",
      );
      expect(result).toEqual(rooms);
    });

    it("surfaces the server's error message on failure", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ error: "Invalid date range" }, 400),
      );
      await expect(
        fetchAvailableRooms("2026-09-05", "2026-09-01"),
      ).rejects.toThrow("Invalid date range");
    });

    it("falls back to a default message when the error body is unparsable", async () => {
      fetchSpy.mockResolvedValueOnce(new Response("not json", { status: 500 }));
      await expect(
        fetchAvailableRooms("2026-09-01", "2026-09-05"),
      ).rejects.toThrow("Failed to fetch available rooms");
    });
  });

  describe("createRoom", () => {
    it("POSTs to /api/rooms with the payload and returns the created room", async () => {
      const data = { roomNumber: "101", capacity: 2, pricePerNight: 150 };
      const created = { id: "r1", ...data };
      fetchSpy.mockResolvedValueOnce(jsonResponse(created, 201));

      const result = await createRoom(data);

      expect(fetchSpy).toHaveBeenCalledWith("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      expect(result).toEqual(created);
    });

    it("surfaces the server's error message on failure", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ error: "Room number already exists" }, 409),
      );
      await expect(
        createRoom({ roomNumber: "101", capacity: 2, pricePerNight: 150 }),
      ).rejects.toThrow("Room number already exists");
    });

    it("propagates network errors", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("network down"));
      await expect(
        createRoom({ roomNumber: "101", capacity: 2, pricePerNight: 150 }),
      ).rejects.toThrow("network down");
    });
  });

  describe("updateRoom", () => {
    it("PUTs to /api/rooms/:id with the payload and returns the updated room", async () => {
      const data = { roomNumber: "102", capacity: 3, pricePerNight: 200 };
      const updated = { id: "r1", ...data };
      fetchSpy.mockResolvedValueOnce(jsonResponse(updated));

      const result = await updateRoom({ id: "r1", data });

      expect(fetchSpy).toHaveBeenCalledWith("/api/rooms/r1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      expect(result).toEqual(updated);
    });

    it("surfaces the server's error message on failure", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ error: "Room not found" }, 404),
      );
      await expect(
        updateRoom({
          id: "missing",
          data: { roomNumber: "102", capacity: 3, pricePerNight: 200 },
        }),
      ).rejects.toThrow("Room not found");
    });
  });

  describe("deleteRoom", () => {
    it("DELETEs /api/rooms/:id", async () => {
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));

      await deleteRoom("r1");

      expect(fetchSpy).toHaveBeenCalledWith("/api/rooms/r1", {
        method: "DELETE",
      });
    });

    it("surfaces the server's error message on failure", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ error: "Cannot delete room with active bookings" }, 409),
      );
      await expect(deleteRoom("r1")).rejects.toThrow(
        "Cannot delete room with active bookings",
      );
    });
  });
});
