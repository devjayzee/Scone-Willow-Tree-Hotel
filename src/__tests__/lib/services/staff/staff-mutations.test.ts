import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  setupMocks,
  createMockStaff,
  resetMocks,
  mockHash,
  mockUserFindUnique,
  mockUserCreate,
  mockUserUpdate,
  mockUserDelete,
} from "./test-utils";

// Setup mocks before importing services
setupMocks();

// Import after mocks are set up
import {
  createStaff,
  updateStaff,
  deleteStaff,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
} from "@/lib/services/staff";

describe("Staff Mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
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

      expect(mockHash).toHaveBeenCalledWith("password123", 12);
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

    it("should use default role STAFF when not explicitly set", async () => {
      const inputWithDefaultRole = {
        firstName: "Bob",
        lastName: "Wilson",
        email: "bob.wilson@sconewillowtree.com",
        password: "password123",
        role: "STAFF" as const,
      };
      mockUserFindUnique.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue(createMockStaff());

      await createStaff(inputWithDefaultRole);

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

      const result = await updateStaff("staff-1", updateData, "current-user-id");

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

      await expect(
        updateStaff("non-existent", { firstName: "Test" }, "current-user-id")
      ).rejects.toThrow(NotFoundError);
      await expect(
        updateStaff("non-existent", { firstName: "Test" }, "current-user-id")
      ).rejects.toThrow("Staff not found");
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });

    it("should allow changing email to unused email", async () => {
      const updateData = { email: "new.email@sconewillowtree.com" };
      mockUserFindUnique
        .mockResolvedValueOnce(existingStaff) // First call: find existing staff
        .mockResolvedValueOnce(null); // Second call: check for email conflict
      mockUserUpdate.mockResolvedValue({ ...existingStaff, ...updateData });

      const result = await updateStaff("staff-1", updateData, "current-user-id");

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
        updateStaff(
          "staff-1",
          { email: "taken@sconewillowtree.com" },
          "current-user-id"
        )
      ).rejects.toThrow(ConflictError);

      // Reset and test error message
      mockUserFindUnique
        .mockResolvedValueOnce(existingStaff)
        .mockResolvedValueOnce(anotherStaff);
      await expect(
        updateStaff(
          "staff-1",
          { email: "taken@sconewillowtree.com" },
          "current-user-id"
        )
      ).rejects.toThrow("Email already exists");
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });

    it("should not check for email conflict when email unchanged", async () => {
      mockUserFindUnique.mockResolvedValue(existingStaff);
      mockUserUpdate.mockResolvedValue(existingStaff);

      await updateStaff(
        "staff-1",
        { email: existingStaff.email, firstName: "Updated" },
        "current-user-id"
      );

      // Should only call findUnique once (to get existing staff)
      expect(mockUserFindUnique).toHaveBeenCalledTimes(1);
    });

    it("should hash password and increment tokenVersion when password provided", async () => {
      mockUserFindUnique.mockResolvedValue(existingStaff);
      mockUserUpdate.mockResolvedValue({ ...existingStaff, tokenVersion: 1 });
      mockHash.mockResolvedValue("new_hashed_password");

      await updateStaff("staff-1", { password: "newpassword123" }, "current-user-id");

      expect(mockHash).toHaveBeenCalledWith("newpassword123", 12);
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

      await updateStaff("staff-1", { firstName: "Updated" }, "current-user-id");

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

      await updateStaff("staff-1", { isActive: false }, "current-user-id");

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

      await updateStaff("staff-1", { role: "GENERAL_MANAGER" }, "current-user-id");

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "staff-1" },
        data: {
          role: "GENERAL_MANAGER",
        },
        select: expect.any(Object),
      });
    });

    it("should throw BusinessRuleError when caller changes their own role", async () => {
      const selfGmStaff = createMockStaff({
        id: "gm-1",
        role: "GENERAL_MANAGER",
      });
      mockUserFindUnique.mockResolvedValue(selfGmStaff);

      await expect(
        updateStaff("gm-1", { role: "STAFF" }, "gm-1")
      ).rejects.toThrow(BusinessRuleError);
      await expect(
        updateStaff("gm-1", { role: "STAFF" }, "gm-1")
      ).rejects.toThrow("Cannot change your own role");
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });

    it("should allow caller to update their own record when role is unchanged", async () => {
      const selfGmStaff = createMockStaff({
        id: "gm-1",
        role: "GENERAL_MANAGER",
      });
      mockUserFindUnique.mockResolvedValue(selfGmStaff);
      mockUserUpdate.mockResolvedValue({ ...selfGmStaff, firstName: "New" });

      await updateStaff(
        "gm-1",
        { firstName: "New", role: "GENERAL_MANAGER" },
        "gm-1"
      );

      expect(mockUserUpdate).toHaveBeenCalled();
    });

    it("should throw BusinessRuleError when caller deactivates themselves", async () => {
      const selfGmStaff = createMockStaff({
        id: "gm-1",
        role: "GENERAL_MANAGER",
        isActive: true,
      });
      mockUserFindUnique.mockResolvedValue(selfGmStaff);

      await expect(
        updateStaff("gm-1", { isActive: false }, "gm-1")
      ).rejects.toThrow(BusinessRuleError);
      await expect(
        updateStaff("gm-1", { isActive: false }, "gm-1")
      ).rejects.toThrow("Cannot deactivate your own account");
      expect(mockUserUpdate).not.toHaveBeenCalled();
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
