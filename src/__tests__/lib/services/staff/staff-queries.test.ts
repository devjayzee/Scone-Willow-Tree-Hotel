import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  setupMocks,
  createMockStaff,
  resetMocks,
  mockUserFindMany,
  mockUserFindUnique,
} from "./test-utils";

// Setup mocks before importing services
setupMocks();

// Import after mocks are set up
import {
  getAllStaff,
  getStaffById,
  NotFoundError,
} from "@/lib/services/staff-service";

describe("Staff Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  // ============================================================
  // getAllStaff
  // ============================================================
  describe("getAllStaff", () => {
    it("should return all staff members ordered by creation date", async () => {
      const mockStaffs = [
        createMockStaff({ id: "staff-2", firstName: "Jane", createdAt: new Date("2024-01-02") }),
        createMockStaff({ id: "staff-1", firstName: "John", createdAt: new Date("2024-01-01") }),
      ];
      mockUserFindMany.mockResolvedValue(mockStaffs);

      const result = await getAllStaff();

      expect(mockUserFindMany).toHaveBeenCalledOnce();
      expect(mockUserFindMany).toHaveBeenCalledWith({
        select: expect.objectContaining({
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isActive: true,
          _count: { select: { bookings: true } },
        }),
        orderBy: { createdAt: "desc" },
      });
      expect(result).toHaveLength(2);
      expect(result[0].firstName).toBe("Jane");
    });

    it("should return empty array when no staff members exist", async () => {
      mockUserFindMany.mockResolvedValue([]);

      const result = await getAllStaff();

      expect(result).toEqual([]);
    });
  });

  // ============================================================
  // getStaffById
  // ============================================================
  describe("getStaffById", () => {
    it("should return staff member when found", async () => {
      const mockStaff = createMockStaff({ id: "staff-123" });
      mockUserFindUnique.mockResolvedValue(mockStaff);

      const result = await getStaffById("staff-123");

      expect(mockUserFindUnique).toHaveBeenCalledWith({
        where: { id: "staff-123" },
        select: expect.objectContaining({
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isActive: true,
        }),
      });
      expect(result.id).toBe("staff-123");
    });

    it("should throw NotFoundError when staff member does not exist", async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await expect(getStaffById("non-existent")).rejects.toThrow(NotFoundError);
      await expect(getStaffById("non-existent")).rejects.toThrow("Staff not found");
    });
  });
});
