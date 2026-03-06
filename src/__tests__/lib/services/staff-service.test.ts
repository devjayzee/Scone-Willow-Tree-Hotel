import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock bcrypt
const mockHash = vi.fn();
vi.mock("bcryptjs", () => ({
  default: {
    hash: (...args: unknown[]) => mockHash(...args),
  },
}));

// Mock Prisma client
const mockUserFindMany = vi.fn();
const mockUserFindUnique = vi.fn();
const mockUserCreate = vi.fn();
const mockUserUpdate = vi.fn();
const mockUserDelete = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      create: (...args: unknown[]) => mockUserCreate(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
      delete: (...args: unknown[]) => mockUserDelete(...args),
    },
  },
}));

// Import after mocks are set up
import {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
} from "@/lib/services/staff-service";

// Helper to create mock staff data
function createMockStaff(
  overrides: Partial<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: "GENERAL_MANAGER" | "STAFF";
    isActive: boolean;
    tokenVersion: number;
    createdAt: Date;
    updatedAt: Date;
    _count: { bookings: number };
  }> = {}
) {
  return {
    id: overrides.id ?? "staff-1",
    firstName: overrides.firstName ?? "John",
    lastName: overrides.lastName ?? "Doe",
    email: overrides.email ?? "john.doe@sconewillowtree.com",
    password: overrides.password ?? "hashedpassword",
    role: overrides.role ?? "STAFF",
    isActive: overrides.isActive ?? true,
    tokenVersion: overrides.tokenVersion ?? 0,
    createdAt: overrides.createdAt ?? new Date("2024-01-01"),
    updatedAt: overrides.updatedAt ?? new Date("2024-01-01"),
    _count: overrides._count ?? { bookings: 0 },
  };
}

describe("Staff Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default bcrypt mock behavior
    mockHash.mockResolvedValue("hashed_password");
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

  // ============================================================
  // createStaff
  // ============================================================
  describe("createStaff", () => {
    const validInput = {
      firstName: "Jane",
      lastName: "Smith",
      email: "jane.smith@sconewillowtree.com",
      password: "password123",
      role: "STAFF" as const,
    };

    it("should create staff member with hashed password", async () => {
      const createdStaff = createMockStaff({
        id: "new-staff",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane.smith@sconewillowtree.com",
      });
      mockUserFindUnique.mockResolvedValue(null); // No existing user
      mockUserCreate.mockResolvedValue(createdStaff);
      mockHash.mockResolvedValue("securely_hashed_password");

      const result = await createStaff(validInput);

      expect(mockHash).toHaveBeenCalledWith("password123", 10);
      expect(mockUserCreate).toHaveBeenCalledWith({
        data: {
          firstName: "Jane",
          lastName: "Smith",
          email: "jane.smith@sconewillowtree.com",
          password: "securely_hashed_password",
          role: "STAFF",
        },
        select: expect.objectContaining({
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isActive: true,
        }),
      });
      expect(result.email).toBe("jane.smith@sconewillowtree.com");
    });

    it("should throw ConflictError when email already exists", async () => {
      mockUserFindUnique.mockResolvedValue(createMockStaff({ email: validInput.email }));

      await expect(createStaff(validInput)).rejects.toThrow(ConflictError);
      await expect(createStaff(validInput)).rejects.toThrow("Email already exists");
      expect(mockUserCreate).not.toHaveBeenCalled();
    });

    it("should use default role STAFF when not provided", async () => {
      const inputWithoutRole = {
        firstName: "Bob",
        lastName: "Wilson",
        email: "bob.wilson@sconewillowtree.com",
        password: "password123",
      };
      mockUserFindUnique.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue(createMockStaff());

      await createStaff(inputWithoutRole);

      expect(mockUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: "STAFF",
          }),
        })
      );
    });

    it("should create staff member with GENERAL_MANAGER role", async () => {
      const managerInput = {
        ...validInput,
        role: "GENERAL_MANAGER" as const,
      };
      mockUserFindUnique.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue(createMockStaff({ role: "GENERAL_MANAGER" }));

      await createStaff(managerInput);

      expect(mockUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: "GENERAL_MANAGER",
          }),
        })
      );
    });
  });

  // ============================================================
  // updateStaff
  // ============================================================
  describe("updateStaff", () => {
    const existingStaff = createMockStaff({
      id: "staff-1",
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@sconewillowtree.com",
      tokenVersion: 0,
    });

    it("should update staff member when it exists", async () => {
      const updateData = { firstName: "Johnny", lastName: "Updated" };
      const updatedStaff = { ...existingStaff, ...updateData };
      mockUserFindUnique.mockResolvedValue(existingStaff);
      mockUserUpdate.mockResolvedValue(updatedStaff);

      const result = await updateStaff("staff-1", updateData);

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "staff-1" },
        data: {
          firstName: "Johnny",
          lastName: "Updated",
        },
        select: expect.any(Object),
      });
      expect(result.firstName).toBe("Johnny");
    });

    it("should throw NotFoundError when staff member does not exist", async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await expect(updateStaff("non-existent", { firstName: "Test" })).rejects.toThrow(
        NotFoundError
      );
      await expect(updateStaff("non-existent", { firstName: "Test" })).rejects.toThrow(
        "Staff not found"
      );
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });

    it("should allow changing email to unused email", async () => {
      const updateData = { email: "new.email@sconewillowtree.com" };
      mockUserFindUnique
        .mockResolvedValueOnce(existingStaff) // First call: find existing staff
        .mockResolvedValueOnce(null); // Second call: check for email conflict
      mockUserUpdate.mockResolvedValue({ ...existingStaff, ...updateData });

      const result = await updateStaff("staff-1", updateData);

      expect(mockUserFindUnique).toHaveBeenCalledTimes(2);
      expect(result.email).toBe("new.email@sconewillowtree.com");
    });

    it("should throw ConflictError when changing to existing email", async () => {
      const anotherStaff = createMockStaff({
        id: "staff-2",
        email: "taken@sconewillowtree.com",
      });
      mockUserFindUnique
        .mockResolvedValueOnce(existingStaff) // First call: find existing staff
        .mockResolvedValueOnce(anotherStaff); // Second call: email exists

      await expect(
        updateStaff("staff-1", { email: "taken@sconewillowtree.com" })
      ).rejects.toThrow(ConflictError);

      // Reset and test error message
      mockUserFindUnique
        .mockResolvedValueOnce(existingStaff)
        .mockResolvedValueOnce(anotherStaff);
      await expect(
        updateStaff("staff-1", { email: "taken@sconewillowtree.com" })
      ).rejects.toThrow("Email already exists");
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });

    it("should not check for email conflict when email unchanged", async () => {
      mockUserFindUnique.mockResolvedValue(existingStaff);
      mockUserUpdate.mockResolvedValue(existingStaff);

      await updateStaff("staff-1", { email: existingStaff.email, firstName: "Updated" });

      // Should only call findUnique once (to get existing staff)
      expect(mockUserFindUnique).toHaveBeenCalledTimes(1);
    });

    it("should hash password and increment tokenVersion when password provided", async () => {
      mockUserFindUnique.mockResolvedValue(existingStaff);
      mockUserUpdate.mockResolvedValue({ ...existingStaff, tokenVersion: 1 });
      mockHash.mockResolvedValue("new_hashed_password");

      await updateStaff("staff-1", { password: "newpassword123" });

      expect(mockHash).toHaveBeenCalledWith("newpassword123", 10);
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "staff-1" },
        data: {
          password: "new_hashed_password",
          tokenVersion: { increment: 1 },
        },
        select: expect.any(Object),
      });
    });

    it("should not increment tokenVersion when password not provided", async () => {
      mockUserFindUnique.mockResolvedValue(existingStaff);
      mockUserUpdate.mockResolvedValue(existingStaff);

      await updateStaff("staff-1", { firstName: "Updated" });

      expect(mockHash).not.toHaveBeenCalled();
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "staff-1" },
        data: {
          firstName: "Updated",
        },
        select: expect.any(Object),
      });
    });

    it("should update isActive status", async () => {
      mockUserFindUnique.mockResolvedValue(existingStaff);
      mockUserUpdate.mockResolvedValue({ ...existingStaff, isActive: false });

      await updateStaff("staff-1", { isActive: false });

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "staff-1" },
        data: {
          isActive: false,
        },
        select: expect.any(Object),
      });
    });

    it("should update role", async () => {
      mockUserFindUnique.mockResolvedValue(existingStaff);
      mockUserUpdate.mockResolvedValue({ ...existingStaff, role: "GENERAL_MANAGER" });

      await updateStaff("staff-1", { role: "GENERAL_MANAGER" });

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "staff-1" },
        data: {
          role: "GENERAL_MANAGER",
        },
        select: expect.any(Object),
      });
    });
  });

  // ============================================================
  // deleteStaff
  // ============================================================
  describe("deleteStaff", () => {
    it("should delete staff member when they have no active bookings", async () => {
      const staffWithNoBookings = {
        ...createMockStaff({ id: "staff-1" }),
        bookings: [],
      };
      mockUserFindUnique.mockResolvedValue(staffWithNoBookings);
      mockUserDelete.mockResolvedValue(undefined);

      const result = await deleteStaff("staff-1", "current-user-id");

      expect(mockUserFindUnique).toHaveBeenCalledWith({
        where: { id: "staff-1" },
        include: {
          bookings: {
            where: {
              status: { in: ["CONFIRMED", "CHECKED_IN"] },
            },
          },
        },
      });
      expect(mockUserDelete).toHaveBeenCalledWith({
        where: { id: "staff-1" },
      });
      expect(result).toEqual({
        deleted: true,
        deactivated: false,
        message: "Staff deleted successfully",
      });
    });

    it("should throw NotFoundError when staff member does not exist", async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await expect(deleteStaff("non-existent", "current-user")).rejects.toThrow(NotFoundError);
      await expect(deleteStaff("non-existent", "current-user")).rejects.toThrow(
        "Staff not found"
      );
      expect(mockUserDelete).not.toHaveBeenCalled();
    });

    it("should throw BusinessRuleError when attempting self-deletion", async () => {
      await expect(deleteStaff("user-123", "user-123")).rejects.toThrow(BusinessRuleError);
      await expect(deleteStaff("user-123", "user-123")).rejects.toThrow(
        "Cannot delete your own account"
      );
      expect(mockUserFindUnique).not.toHaveBeenCalled();
      expect(mockUserDelete).not.toHaveBeenCalled();
    });

    it("should deactivate staff member when they have active bookings", async () => {
      const staffWithBookings = {
        ...createMockStaff({ id: "staff-1" }),
        bookings: [
          { id: "booking-1", status: "CONFIRMED" },
          { id: "booking-2", status: "CHECKED_IN" },
        ],
      };
      mockUserFindUnique.mockResolvedValue(staffWithBookings);
      mockUserUpdate.mockResolvedValue({ ...staffWithBookings, isActive: false });

      const result = await deleteStaff("staff-1", "current-user-id");

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "staff-1" },
        data: { isActive: false },
      });
      expect(mockUserDelete).not.toHaveBeenCalled();
      expect(result).toEqual({
        deleted: false,
        deactivated: true,
        message: "Staff deactivated (has active bookings)",
      });
    });

    it("should allow deletion when staff only has cancelled/checked-out bookings", async () => {
      // The query filters for CONFIRMED/CHECKED_IN, so cancelled bookings
      // won't be in the result
      const staffWithNoActiveBookings = {
        ...createMockStaff({ id: "staff-1" }),
        bookings: [], // Empty because query filtered out CANCELLED/CHECKED_OUT
      };
      mockUserFindUnique.mockResolvedValue(staffWithNoActiveBookings);
      mockUserDelete.mockResolvedValue(undefined);

      const result = await deleteStaff("staff-1", "current-user-id");

      expect(mockUserDelete).toHaveBeenCalled();
      expect(result.deleted).toBe(true);
    });
  });
});
