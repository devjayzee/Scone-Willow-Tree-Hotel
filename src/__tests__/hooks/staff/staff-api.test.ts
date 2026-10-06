import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchStaffs,
  createStaff,
  resendInvite,
  updateStaff,
  deleteStaff,
} from "@/hooks/staff/staff-api";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("staff-api", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("fetchStaffs", () => {
    it("GETs /api/staffs and returns the parsed list", async () => {
      const staffs = [{ id: "s1" }, { id: "s2" }];
      fetchSpy.mockResolvedValueOnce(jsonResponse(staffs));

      const result = await fetchStaffs();

      expect(fetchSpy).toHaveBeenCalledWith("/api/staffs");
      expect(result).toEqual(staffs);
    });

    it("throws a plain Error when the response is not ok", async () => {
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 500 }));
      await expect(fetchStaffs()).rejects.toThrow("Failed to fetch staffs");
    });
  });

  describe("createStaff", () => {
    it("POSTs to /api/staffs with the payload and returns the created staff", async () => {
      const data = {
        firstName: "Alice",
        lastName: "Smith",
        email: "alice@example.com",
        role: "STAFF" as const,
      };
      const created = { id: "s1", ...data };
      fetchSpy.mockResolvedValueOnce(jsonResponse(created, 201));

      const result = await createStaff(data);

      expect(fetchSpy).toHaveBeenCalledWith("/api/staffs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      expect(result).toEqual(created);
    });

    it("surfaces the server's error message on failure", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ error: "Email domain not allowed" }, 400),
      );
      await expect(
        createStaff({
          firstName: "Alice",
          lastName: "Smith",
          email: "alice@bad.com",
          role: "STAFF",
        }),
      ).rejects.toThrow("Email domain not allowed");
    });

    it("propagates network errors", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("network down"));
      await expect(
        createStaff({
          firstName: "Alice",
          lastName: "Smith",
          email: "alice@example.com",
          role: "STAFF",
        }),
      ).rejects.toThrow("network down");
    });
  });

  describe("resendInvite", () => {
    it("POSTs to /api/staffs/:id/resend-invite", async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: true }));

      const result = await resendInvite("s1");

      expect(fetchSpy).toHaveBeenCalledWith("/api/staffs/s1/resend-invite", {
        method: "POST",
      });
      expect(result).toEqual({ ok: true });
    });

    it("surfaces the server's error message on failure", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ error: "Staff already active" }, 400),
      );
      await expect(resendInvite("s1")).rejects.toThrow("Staff already active");
    });
  });

  describe("updateStaff", () => {
    it("PUTs to /api/staffs/:id with the payload and returns the updated staff", async () => {
      const data = { firstName: "Alicia" };
      const updated = { id: "s1", ...data };
      fetchSpy.mockResolvedValueOnce(jsonResponse(updated));

      const result = await updateStaff({ id: "s1", data });

      expect(fetchSpy).toHaveBeenCalledWith("/api/staffs/s1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      expect(result).toEqual(updated);
    });

    it("surfaces the server's error message on failure", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ error: "Staff not found" }, 404),
      );
      await expect(
        updateStaff({ id: "missing", data: { firstName: "Alicia" } }),
      ).rejects.toThrow("Staff not found");
    });
  });

  describe("deleteStaff", () => {
    it("DELETEs /api/staffs/:id and returns the response body", async () => {
      const body = { message: "Staff deactivated", deactivated: true };
      fetchSpy.mockResolvedValueOnce(jsonResponse(body));

      const result = await deleteStaff("s1");

      expect(fetchSpy).toHaveBeenCalledWith("/api/staffs/s1", {
        method: "DELETE",
      });
      expect(result).toEqual(body);
    });

    it("surfaces the server's error message on failure", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ error: "Only managers can delete staff" }, 403),
      );
      await expect(deleteStaff("s1")).rejects.toThrow(
        "Only managers can delete staff",
      );
    });
  });
});
