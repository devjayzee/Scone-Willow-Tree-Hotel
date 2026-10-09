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
  mockIssueSetupTokenForUser,
  mockVoidActiveTokens,
  mockTransaction,
  mockTxClient,
  mockTxUserUpdate,
} from "./test-utils";
import { createAuditLog } from "@/lib/services/audit-service";

// Setup mocks before importing services
setupMocks();

// Import after mocks are set up
import {
  createStaff,
  updateStaff,
  deleteStaff,
  resendInvite,
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
  // createStaff (invite flow)
  // ============================================================
  describe("createStaff", () => {
    const validInput = {
      firstName: "Jane",
      lastName: "Smith",
      email: "jane.smith@sconewillowtree.com",
      role: "STAFF" as const,
    };

    it("creates an inactive staff with a per-user random placeholder hash and issues a setup token", async () => {
      const createdStaff = createMockStaff({
        id: "new-staff",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane.smith@sconewillowtree.com",
        isActive: false,
        setupPending: true,
      });
      mockUserFindUnique.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue(createdStaff);
      mockIssueSetupTokenForUser.mockResolvedValue("raw-setup-token");
      mockHash.mockResolvedValue("random-placeholder-hash");

      const result = await createStaff(validInput);

      // Per-user random hash (not the shared DUMMY_PASSWORD_HASH).
      expect(mockHash).toHaveBeenCalledTimes(1);
      const [randomPlaintext, cost] = mockHash.mock.calls[0];
      expect(typeof randomPlaintext).toBe("string");
      expect((randomPlaintext as string).length).toBeGreaterThan(20);
      expect(cost).toBe(12);
      expect(mockUserCreate).toHaveBeenCalledWith({
        data: {
          firstName: "Jane",
          lastName: "Smith",
          email: "jane.smith@sconewillowtree.com",
          password: "random-placeholder-hash",
          role: "STAFF",
          isActive: false,
          setupPending: true,
        },
        select: expect.objectContaining({
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isActive: true,
          setupPending: true,
        }),
      });
      expect(mockIssueSetupTokenForUser).toHaveBeenCalledWith("new-staff");
      expect(result).toEqual({
        staff: createdStaff,
        setupToken: "raw-setup-token",
      });
    });

    it("throws ConflictError when email already exists and skips token issuance", async () => {
      mockUserFindUnique.mockResolvedValue(
        createMockStaff({ email: validInput.email })
      );

      await expect(createStaff(validInput)).rejects.toThrow(ConflictError);
      await expect(createStaff(validInput)).rejects.toThrow("Email already exists");
      expect(mockUserCreate).not.toHaveBeenCalled();
      expect(mockIssueSetupTokenForUser).not.toHaveBeenCalled();
    });

    it("uses default role STAFF when not explicitly set", async () => {
      const inputWithDefaultRole = {
        firstName: "Bob",
        lastName: "Wilson",
        email: "bob.wilson@sconewillowtree.com",
        role: "STAFF" as const,
      };
      mockUserFindUnique.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue(createMockStaff());

      await createStaff(inputWithDefaultRole);

      expect(mockUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: "STAFF" }),
        })
      );
    });

    it("supports the GENERAL_MANAGER role", async () => {
      mockUserFindUnique.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue(
        createMockStaff({ role: "GENERAL_MANAGER" })
      );

      await createStaff({ ...validInput, role: "GENERAL_MANAGER" });

      expect(mockUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: "GENERAL_MANAGER" }),
        })
      );
    });
  });

  // ============================================================
  // resendInvite
  // ============================================================
  describe("resendInvite", () => {
    it("issues a fresh setup token for a pending invite and returns the invited user projection", async () => {
      mockUserFindUnique.mockResolvedValue({
        id: "u1",
        email: "invitee@example.com",
        firstName: "Ivy",
        isActive: false,
        setupPending: true,
      });
      mockIssueSetupTokenForUser.mockResolvedValue("fresh-token");

      const result = await resendInvite("u1", "manager-1");

      expect(mockUserFindUnique).toHaveBeenCalledWith({
        where: { id: "u1" },
        select: expect.objectContaining({ setupPending: true }),
      });
      expect(mockIssueSetupTokenForUser).toHaveBeenCalledWith("u1");
      expect(result).toEqual({
        user: { id: "u1", email: "invitee@example.com", firstName: "Ivy" },
        setupToken: "fresh-token",
      });
    });

    it("throws NotFoundError for an unknown user", async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await expect(resendInvite("ghost", "manager-1")).rejects.toThrow(
        NotFoundError
      );
      expect(mockIssueSetupTokenForUser).not.toHaveBeenCalled();
    });

    it("throws BusinessRuleError for an already-active staff member", async () => {
      mockUserFindUnique.mockResolvedValue({
        id: "u1",
        email: "active@example.com",
        firstName: "Ann",
        isActive: true,
        setupPending: false,
      });

      const result = resendInvite("u1", "manager-1");
      await expect(result).rejects.toThrow(BusinessRuleError);
      await expect(result).rejects.toMatchObject({
        message:
          "Cannot resend invite: this staff member has already completed setup",
      });
      expect(mockIssueSetupTokenForUser).not.toHaveBeenCalled();
    });

    it("refuses a deactivated user who completed setup: no token, no audit", async () => {
      mockUserFindUnique.mockResolvedValue({
        id: "u2",
        email: "exemployee@example.com",
        firstName: "Eve",
        isActive: false,
        setupPending: false,
      });

      const result = resendInvite("u2", "manager-1");
      await expect(result).rejects.toThrow(BusinessRuleError);
      await expect(result).rejects.toMatchObject({
        message:
          "This account has been deactivated. Use Activate to restore access.",
      });
      expect(mockIssueSetupTokenForUser).not.toHaveBeenCalled();
      expect(createAuditLog).not.toHaveBeenCalled();
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

    it("never hashes a password or touches tokenVersion — password rotation lives on /reset-password", async () => {
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

    describe("setupPending handling", () => {
      it("refuses isActive:true on a pending invite: no transaction, no audit", async () => {
        const pending = createMockStaff({
          id: "staff-9",
          isActive: false,
          setupPending: true,
        });
        mockUserFindUnique.mockResolvedValue(pending);

        await expect(
          updateStaff("staff-9", { isActive: true }, "current-user-id")
        ).rejects.toThrow(BusinessRuleError);
        expect(mockTransaction).not.toHaveBeenCalled();
        expect(mockUserUpdate).not.toHaveBeenCalled();
        expect(createAuditLog).not.toHaveBeenCalled();
      });

      it("activates a deactivated non-pending user and audits STAFF_ACTIVATED", async () => {
        const deactivated = createMockStaff({
          id: "staff-8",
          isActive: false,
          setupPending: false,
        });
        mockUserFindUnique.mockResolvedValue(deactivated);
        mockUserUpdate.mockResolvedValue({ ...deactivated, isActive: true });

        await updateStaff("staff-8", { isActive: true }, "current-user-id");

        expect(mockUserUpdate).toHaveBeenCalledWith({
          where: { id: "staff-8" },
          data: { isActive: true },
          select: expect.any(Object),
        });
        expect(createAuditLog).toHaveBeenCalledWith(
          "current-user-id",
          "STAFF_ACTIVATED",
          "STAFF",
          "staff-8",
          expect.anything()
        );
      });

      it("never writes setupPending even if the input carries it", async () => {
        mockUserFindUnique.mockResolvedValue(existingStaff);
        mockUserUpdate.mockResolvedValue(existingStaff);

        await updateStaff(
          "staff-1",
          { firstName: "Updated", setupPending: true } as never,
          "current-user-id"
        );

        const arg = mockUserUpdate.mock.calls[0][0];
        expect(arg.data).not.toHaveProperty("setupPending");
        expect(arg.data).toEqual({ firstName: "Updated" });
      });
    });

    describe("email change voids outstanding tokens", () => {
      const newEmail = "new.email@sconewillowtree.com";

      function arrangeEmailChange() {
        mockUserFindUnique
          .mockResolvedValueOnce(existingStaff)
          .mockResolvedValueOnce(null);
        mockUserUpdate.mockResolvedValue({ ...existingStaff, email: newEmail });
      }

      function voidedAuditCalls() {
        return vi
          .mocked(createAuditLog)
          .mock.calls.filter((c) => (c[1] as string) === "STAFF_TOKENS_VOIDED");
      }

      it("voids SETUP and RESET tokens on the transaction client when the email changes", async () => {
        arrangeEmailChange();

        await updateStaff("staff-1", { email: newEmail }, "current-user-id");

        expect(mockVoidActiveTokens).toHaveBeenCalledTimes(2);
        expect(mockVoidActiveTokens).toHaveBeenCalledWith(
          "staff-1",
          "SETUP",
          mockTxClient
        );
        expect(mockVoidActiveTokens).toHaveBeenCalledWith(
          "staff-1",
          "RESET",
          mockTxClient
        );
      });

      it("does not void tokens for non-email updates", async () => {
        mockUserFindUnique.mockResolvedValue(existingStaff);
        mockUserUpdate.mockResolvedValue(existingStaff);

        await updateStaff(
          "staff-1",
          { firstName: "Johnny", role: "MANAGER", isActive: false },
          "current-user-id"
        );

        expect(mockVoidActiveTokens).not.toHaveBeenCalled();
        expect(voidedAuditCalls()).toHaveLength(0);
      });

      it.each([
        ["identical", "john.doe@sconewillowtree.com", "john.doe@sconewillowtree.com"],
        ["case-only", "john.doe@sconewillowtree.com", "John.Doe@sconewillowtree.com"],
      ])(
        "does not void tokens or audit when the email is %s",
        async (_label, newValue, storedEmail) => {
          const stored = { ...existingStaff, email: storedEmail };
          // 2nd lookup (conflict check, only reached for a case-only diff) finds nothing
          mockUserFindUnique
            .mockResolvedValueOnce(stored)
            .mockResolvedValue(null);
          mockUserUpdate.mockResolvedValue(stored);
          mockVoidActiveTokens.mockResolvedValue(3);

          await updateStaff("staff-1", { email: newValue }, "current-user-id");

          expect(mockVoidActiveTokens).not.toHaveBeenCalled();
          expect(voidedAuditCalls()).toHaveLength(0);
        }
      );

      it("runs the user update and both voids in one transaction on the same client", async () => {
        arrangeEmailChange();
        const txSeen: unknown[] = [];
        mockVoidActiveTokens.mockImplementation(
          async (_id: string, _purpose: string, db: unknown) => {
            txSeen.push(db);
            return 0;
          }
        );

        await updateStaff("staff-1", { email: newEmail }, "current-user-id");

        expect(mockTransaction).toHaveBeenCalledTimes(1);
        expect(mockTxUserUpdate).toHaveBeenCalledTimes(1);
        expect(mockUserUpdate).toHaveBeenCalledTimes(1);
        expect(txSeen).toHaveLength(2);
        expect(txSeen[0]).toBe(mockTxClient);
        expect(txSeen[1]).toBe(mockTxClient);
      });

      it("voids both purposes before the user update (lock order)", async () => {
        arrangeEmailChange();

        await updateStaff("staff-1", { email: newEmail }, "current-user-id");

        const voidOrders = mockVoidActiveTokens.mock.invocationCallOrder;
        const updateOrder = mockTxUserUpdate.mock.invocationCallOrder[0];
        expect(voidOrders).toHaveLength(2);
        expect(Math.max(...voidOrders)).toBeLessThan(updateOrder);
      });

      it("writes a STAFF_TOKENS_VOIDED audit entry with the summed count when tokens were voided", async () => {
        arrangeEmailChange();
        mockVoidActiveTokens
          .mockResolvedValueOnce(1) // SETUP
          .mockResolvedValueOnce(2); // RESET

        await updateStaff("staff-1", { email: newEmail }, "current-user-id");

        expect(createAuditLog).toHaveBeenCalledWith(
          "current-user-id",
          "STAFF_TOKENS_VOIDED",
          "STAFF",
          "staff-1",
          {
            previous: { email: existingStaff.email },
            current: { email: newEmail },
            reason: "Email changed; 3 unused setup/reset link(s) cancelled",
          }
        );
      });

      it("writes no STAFF_TOKENS_VOIDED entry when nothing was voided", async () => {
        arrangeEmailChange();
        mockVoidActiveTokens.mockResolvedValue(0);

        await updateStaff("staff-1", { email: newEmail }, "current-user-id");

        expect(mockVoidActiveTokens).toHaveBeenCalledTimes(2);
        expect(voidedAuditCalls()).toHaveLength(0);
      });

      it("propagates a void failure, skips the user update and writes no audit entry", async () => {
        arrangeEmailChange();
        mockVoidActiveTokens.mockRejectedValue(new Error("db down"));

        await expect(
          updateStaff("staff-1", { email: newEmail }, "current-user-id")
        ).rejects.toThrow("db down");

        expect(mockTxUserUpdate).not.toHaveBeenCalled();
        expect(mockUserUpdate).not.toHaveBeenCalled();
        expect(createAuditLog).not.toHaveBeenCalled();
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
