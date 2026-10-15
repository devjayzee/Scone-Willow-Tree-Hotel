import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
  mockRevokeTrustedDevices,
  mockTransaction,
  mockTxClient,
  mockTxUserUpdate,
  mockInviteLimit,
  mockInviteGlobalLimit,
  mockGetStaffInviteRateLimiter,
  mockGetStaffInviteGlobalRateLimiter,
} from "./test-utils";
import { createAuditLog } from "@/lib/services/audit-service";
import { Prisma } from "@prisma/client";
import { ValidationError, RateLimitError } from "@/lib/errors";

// Setup mocks before importing services
setupMocks();

// Import after mocks are set up
import { createStaff } from "@/lib/services/staff/staff-mutations";
import {
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
      expect(mockIssueSetupTokenForUser).toHaveBeenCalledWith(createdStaff);
      expect(mockIssueSetupTokenForUser.mock.calls[0][0]).toMatchObject({
        id: "new-staff",
        email: "jane.smith@sconewillowtree.com",
      });
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
        where: { id: "staff-1", setupPending: false },
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
        where: { id: "staff-1", setupPending: false },
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
        where: { id: "staff-1", setupPending: false },
        data: {
          isActive: false,
          tokenVersion: { increment: 1 },
        },
        select: expect.any(Object),
      });
    });

    describe("isActive changes end old sessions (tokenVersion bump)", () => {
      const bump = { increment: 1 };
      const updateDataOf = () => mockUserUpdate.mock.calls[0][0].data;

      it("deactivating (true -> false) bumps tokenVersion", async () => {
        mockUserFindUnique.mockResolvedValue(existingStaff);
        mockUserUpdate.mockResolvedValue({ ...existingStaff, isActive: false });

        await updateStaff("staff-1", { isActive: false }, "gm-1");

        expect(updateDataOf().tokenVersion).toEqual(bump);
      });

      it("reactivating (false -> true) bumps tokenVersion", async () => {
        const inactive = { ...existingStaff, isActive: false };
        mockUserFindUnique.mockResolvedValue(inactive);
        mockUserUpdate.mockResolvedValue(existingStaff);

        await updateStaff("staff-1", { isActive: true }, "gm-1");

        expect(updateDataOf().tokenVersion).toEqual(bump);
      });

      it.each([
        ["a role-only edit", { role: "MANAGER" as const }],
        ["a name-only edit", { firstName: "Johnny", lastName: "Updated" }],
      ])("%s does not bump tokenVersion", async (_label, input) => {
        mockUserFindUnique.mockResolvedValue(existingStaff);
        mockUserUpdate.mockResolvedValue(existingStaff);

        await updateStaff("staff-1", input, "gm-1");

        expect(updateDataOf()).not.toHaveProperty("tokenVersion");
      });

      it.each([
        ["active -> isActive: true", existingStaff, true],
        ["inactive -> isActive: false", { ...existingStaff, isActive: false }, false],
      ])("isActive equal to the current value (%s) does not bump", async (_l, row, value) => {
        mockUserFindUnique.mockResolvedValue(row);
        mockUserUpdate.mockResolvedValue(row);

        await updateStaff("staff-1", { isActive: value }, "gm-1");

        expect(updateDataOf()).not.toHaveProperty("tokenVersion");
      });

      it("the access reset still sends exactly one { increment: 1 }", async () => {
        const setUp = createMockStaff({
          id: "staff-1",
          email: "wrong.person@sconewillowtree.com",
          setupPending: false,
        });
        mockHash.mockResolvedValue("placeholder-hash");
        mockUserFindUnique
          .mockResolvedValueOnce(setUp)
          .mockResolvedValueOnce(null);
        mockUserUpdate.mockResolvedValue(setUp);

        await updateStaff(
          "staff-1",
          { email: "right.person@sconewillowtree.com" },
          "gm-1"
        );

        expect(updateDataOf().tokenVersion).toEqual(bump);
        expect(updateDataOf().isActive).toBe(false);
      });
    });

    it("should update role", async () => {
      mockUserFindUnique.mockResolvedValue(existingStaff);
      mockUserUpdate.mockResolvedValue({ ...existingStaff, role: "GENERAL_MANAGER" });

      await updateStaff("staff-1", { role: "GENERAL_MANAGER" }, "current-user-id");

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "staff-1", setupPending: false },
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
          where: { id: "staff-8", setupPending: false },
          data: { isActive: true, tokenVersion: { increment: 1 } },
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

    describe("recipient-domain allowlist on email change", () => {
      const originalAllowlist = process.env.INVITE_DOMAIN_ALLOWLIST;

      beforeEach(() => {
        process.env.INVITE_DOMAIN_ALLOWLIST = "hotel.test";
      });

      afterEach(() => {
        if (originalAllowlist === undefined) {
          delete process.env.INVITE_DOMAIN_ALLOWLIST;
        } else {
          process.env.INVITE_DOMAIN_ALLOWLIST = originalAllowlist;
        }
      });

      it("T4: refuses an email change to a domain outside the allowlist: no transaction, no write, no audit", async () => {
        const pending = createMockStaff({
          id: "staff-1",
          email: "pending@hotel.test",
          isActive: false,
          setupPending: true,
        });
        mockUserFindUnique
          .mockResolvedValueOnce(pending)
          .mockResolvedValueOnce(null); // no email conflict
        mockUserUpdate.mockResolvedValue({
          ...pending,
          email: "attacker@evil.example",
        });

        const result = updateStaff(
          "staff-1",
          { email: "attacker@evil.example" },
          "current-user-id"
        );

        await expect(result).rejects.toThrow(ValidationError);
        await expect(result).rejects.toMatchObject({
          message: "Recipient email domain is not allowed on this deployment.",
        });
        expect(mockTransaction).not.toHaveBeenCalled();
        expect(mockUserUpdate).not.toHaveBeenCalled();
        expect(mockVoidActiveTokens).not.toHaveBeenCalled();
        expect(createAuditLog).not.toHaveBeenCalled();
      });

      it("refuses an outside-domain email that is also taken with ValidationError, before the conflict lookup", async () => {
        const pending = createMockStaff({
          id: "staff-1",
          email: "pending@hotel.test",
          isActive: false,
          setupPending: true,
        });
        const taken = createMockStaff({
          id: "staff-2",
          email: "taken@evil.example",
        });
        mockUserFindUnique
          .mockResolvedValueOnce(pending)
          .mockResolvedValueOnce(taken);

        const result = updateStaff(
          "staff-1",
          { email: "taken@evil.example" },
          "current-user-id"
        );

        await expect(result).rejects.toThrow(ValidationError);
        await expect(result).rejects.not.toThrow(ConflictError);
        expect(mockUserFindUnique).toHaveBeenCalledTimes(1);
        expect(mockUserUpdate).not.toHaveBeenCalled();
      });

      it("allows an email change to a domain inside the allowlist", async () => {
        const pending = createMockStaff({
          id: "staff-1",
          email: "pending@hotel.test",
        });
        mockUserFindUnique
          .mockResolvedValueOnce(pending)
          .mockResolvedValueOnce(null);
        mockUserUpdate.mockResolvedValue({
          ...pending,
          email: "other@hotel.test",
        });

        const result = await updateStaff(
          "staff-1",
          { email: "other@hotel.test" },
          "current-user-id"
        );

        expect(result.email).toBe("other@hotel.test");
        expect(mockTransaction).toHaveBeenCalledTimes(1);
      });

      it("T5: allows a name edit on a legacy account whose unchanged email is outside the allowlist", async () => {
        const legacy = createMockStaff({
          id: "staff-1",
          email: "legacy@old-domain.example",
        });
        mockUserFindUnique.mockResolvedValue(legacy);
        mockUserUpdate.mockResolvedValue({ ...legacy, firstName: "Renamed" });

        const result = await updateStaff(
          "staff-1",
          { firstName: "Renamed", email: legacy.email },
          "current-user-id"
        );

        expect(result.firstName).toBe("Renamed");
        expect(mockUserUpdate).toHaveBeenCalledTimes(1);
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

    describe("trusted-device revocation", () => {
      const newEmail = "new.email@sconewillowtree.com";
      const oldEmail = existingStaff.email;
      const originalAllowlist = process.env.INVITE_DOMAIN_ALLOWLIST;

      beforeEach(() => {
        delete process.env.INVITE_DOMAIN_ALLOWLIST;
      });

      afterEach(() => {
        if (originalAllowlist === undefined) {
          delete process.env.INVITE_DOMAIN_ALLOWLIST;
        } else {
          process.env.INVITE_DOMAIN_ALLOWLIST = originalAllowlist;
        }
      });

      function arrangeEmailChange() {
        mockUserFindUnique
          .mockResolvedValueOnce(existingStaff)
          .mockResolvedValueOnce(null);
        mockUserUpdate.mockResolvedValue({ ...existingStaff, email: newEmail });
      }

      function arrangeUpdate() {
        mockUserFindUnique.mockResolvedValue(existingStaff);
        mockUserUpdate.mockResolvedValue(existingStaff);
      }

      it("S7: an email change revokes the NEW email once, after the spend and before the transaction", async () => {
        arrangeEmailChange();

        await updateStaff("staff-1", { email: newEmail }, "gm-1");

        expect(mockRevokeTrustedDevices).toHaveBeenCalledTimes(1);
        expect(mockRevokeTrustedDevices.mock.calls[0][0]).toBe(newEmail);
        const spendOrder = mockInviteGlobalLimit.mock.invocationCallOrder[0];
        const revokeOrder = mockRevokeTrustedDevices.mock.invocationCallOrder[0];
        const txOrder = mockTransaction.mock.invocationCallOrder[0];
        expect(spendOrder).toBeLessThan(revokeOrder);
        expect(revokeOrder).toBeLessThan(txOrder);
      });

      it("S7: a refused invite spend revokes nothing", async () => {
        arrangeEmailChange();
        mockInviteLimit.mockResolvedValue({ success: false });

        await expect(
          updateStaff("staff-1", { email: newEmail }, "gm-1")
        ).rejects.toThrow(RateLimitError);

        expect(mockRevokeTrustedDevices).not.toHaveBeenCalled();
      });

      it("S8: a deactivation revokes the account's devices before the transaction", async () => {
        arrangeUpdate();

        await updateStaff("staff-1", { isActive: false }, "gm-1");

        expect(mockRevokeTrustedDevices).toHaveBeenCalledTimes(1);
        expect(mockRevokeTrustedDevices.mock.calls[0][0]).toBe(oldEmail);
        expect(mockRevokeTrustedDevices.mock.invocationCallOrder[0]).toBeLessThan(
          mockTransaction.mock.invocationCallOrder[0]
        );
      });

      it.each([
        ["an email change", { email: newEmail }],
        ["a deactivation", { isActive: false }],
      ])(
        "S9: a revoke error on %s aborts with no transaction, no write and no audit",
        async (_label, input) => {
          if ("email" in input) arrangeEmailChange();
          else arrangeUpdate();
          mockRevokeTrustedDevices.mockRejectedValue(new Error("redis down"));

          await expect(updateStaff("staff-1", input, "gm-1")).rejects.toThrow(
            "redis down"
          );

          expect(mockTransaction).not.toHaveBeenCalled();
          expect(mockUserUpdate).not.toHaveBeenCalled();
          expect(mockVoidActiveTokens).not.toHaveBeenCalled();
          expect(createAuditLog).not.toHaveBeenCalled();
        }
      );

      it.each([
        ["a name edit", { firstName: "Johnny" }, existingStaff],
        ["a role edit", { role: "MANAGER" as const }, existingStaff],
        [
          "an isActive: true edit on an already-active account",
          { isActive: true },
          existingStaff,
        ],
      ])("S11 (guard): %s does not revoke", async (_label, input, row) => {
        mockUserFindUnique.mockResolvedValue(row);
        mockUserUpdate.mockResolvedValue(row);

        await updateStaff("staff-1", input, "gm-1");

        expect(mockUserUpdate).toHaveBeenCalledTimes(1);
        expect(mockRevokeTrustedDevices).not.toHaveBeenCalled();
      });

      describe("reactivation", () => {
        const inactive = { ...existingStaff, isActive: false };

        it("S12: reactivating an inactive account revokes its email before the transaction", async () => {
          mockUserFindUnique.mockResolvedValue(inactive);
          mockUserUpdate.mockResolvedValue(existingStaff);

          await updateStaff("staff-1", { isActive: true }, "gm-1");

          expect(mockRevokeTrustedDevices).toHaveBeenCalledTimes(1);
          expect(mockRevokeTrustedDevices.mock.calls[0][0]).toBe(oldEmail);
          expect(
            mockRevokeTrustedDevices.mock.invocationCallOrder[0]
          ).toBeLessThan(mockTransaction.mock.invocationCallOrder[0]);
        });

        it("S12: a revoke error on reactivation aborts with no transaction, no write and no audit", async () => {
          mockUserFindUnique.mockResolvedValue(inactive);
          mockUserUpdate.mockResolvedValue(existingStaff);
          mockRevokeTrustedDevices.mockRejectedValue(new Error("redis down"));

          await expect(
            updateStaff("staff-1", { isActive: true }, "gm-1")
          ).rejects.toThrow("redis down");

          expect(mockTransaction).not.toHaveBeenCalled();
          expect(mockUserUpdate).not.toHaveBeenCalled();
          expect(createAuditLog).not.toHaveBeenCalled();
        });

        // B: on a set-up account that is not the caller's, this combination is
        // now refused (see "access reset"). It stays allowed on the caller's
        // own account, so the exactly-once revoke is checked there.
        it("S12: an email change with a reactivation on the caller's own account revokes the new email exactly once", async () => {
          const selfInactive = { ...inactive, id: "gm-1" };
          mockUserFindUnique
            .mockResolvedValueOnce(selfInactive)
            .mockResolvedValueOnce(null);
          mockUserUpdate.mockResolvedValue({ ...selfInactive, email: newEmail });

          await updateStaff(
            "gm-1",
            { email: newEmail, isActive: true },
            "gm-1"
          );

          expect(mockRevokeTrustedDevices).toHaveBeenCalledTimes(1);
          expect(mockRevokeTrustedDevices.mock.calls[0][0]).toBe(newEmail);
        });
      });

      // B: on a set-up, non-self account the combination is refused. A pending
      // account is not reset, so the combination still reaches the revoke.
      it("S13 (guard): an email change with isActive:false on a pending account revokes the new email exactly once", async () => {
        const pending = createMockStaff({
          id: "staff-1",
          isActive: false,
          setupPending: true,
        });
        mockUserFindUnique
          .mockResolvedValueOnce(pending)
          .mockResolvedValueOnce(null);
        mockUserUpdate.mockResolvedValue({ ...pending, email: newEmail });

        await updateStaff(
          "staff-1",
          { email: newEmail, isActive: false },
          "gm-1"
        );

        expect(mockRevokeTrustedDevices).toHaveBeenCalledTimes(1);
        expect(mockRevokeTrustedDevices.mock.calls[0][0]).toBe(newEmail);
      });
    });

    describe("access reset on an email change (B)", () => {
      const newEmail = "right.person@sconewillowtree.com";
      const originalAllowlist = process.env.INVITE_DOMAIN_ALLOWLIST;
      const RESET_HASH = "reset_placeholder_hash";
      const MIXED_MESSAGE =
        "Change the email on its own. The account will need a new invite.";

      beforeEach(() => {
        delete process.env.INVITE_DOMAIN_ALLOWLIST;
        mockHash.mockResolvedValue(RESET_HASH);
      });

      afterEach(() => {
        if (originalAllowlist === undefined) {
          delete process.env.INVITE_DOMAIN_ALLOWLIST;
        } else {
          process.env.INVITE_DOMAIN_ALLOWLIST = originalAllowlist;
        }
      });

      const setUp = createMockStaff({
        id: "staff-1",
        email: "wrong.person@sconewillowtree.com",
        password: "chosen_by_wrong_person",
        isActive: true,
        setupPending: false,
        role: "MANAGER",
      });

      function arrange(row: ReturnType<typeof createMockStaff>) {
        mockUserFindUnique
          .mockResolvedValueOnce(row)
          .mockResolvedValueOnce(null);
        mockUserUpdate.mockResolvedValue({
          ...row,
          email: newEmail,
          isActive: false,
          setupPending: true,
        });
      }

      function actionCalls(action: string) {
        return vi
          .mocked(createAuditLog)
          .mock.calls.filter((c) => (c[1] as string) === action);
      }

      it("S1: an active set-up account resets: placeholder hash, tokenVersion + 1, pending, inactive, new email", async () => {
        arrange(setUp);

        const result = await updateStaff(
          "staff-1",
          { email: newEmail },
          "gm-1"
        );

        expect(mockHash).toHaveBeenCalledTimes(1);
        expect(mockHash.mock.calls[0][0]).toEqual(expect.any(String));
        expect(mockHash.mock.calls[0][0]).not.toBe(setUp.password);
        expect(mockUserUpdate).toHaveBeenCalledWith({
          where: { id: "staff-1", setupPending: false },
          data: {
            email: newEmail,
            password: RESET_HASH,
            tokenVersion: { increment: 1 },
            setupPending: true,
            isActive: false,
          },
          select: expect.any(Object),
        });
        expect(result.setupPending).toBe(true);
        expect(result.isActive).toBe(false);
      });

      it("S1: the reset writes on the transaction client and voids SETUP and RESET tokens first", async () => {
        arrange(setUp);

        await updateStaff("staff-1", { email: newEmail }, "gm-1");

        expect(mockTransaction).toHaveBeenCalledTimes(1);
        expect(mockTxUserUpdate).toHaveBeenCalledTimes(1);
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
        expect(
          Math.max(...mockVoidActiveTokens.mock.invocationCallOrder)
        ).toBeLessThan(mockTxUserUpdate.mock.invocationCallOrder[0]);
      });

      it("S2: writes one STAFF_ACCESS_RESET audit entry with previous, current and a reason", async () => {
        arrange(setUp);

        await updateStaff("staff-1", { email: newEmail }, "gm-1");

        expect(actionCalls("STAFF_ACCESS_RESET")).toHaveLength(1);
        expect(createAuditLog).toHaveBeenCalledWith(
          "gm-1",
          "STAFF_ACCESS_RESET",
          "STAFF",
          "staff-1",
          {
            previous: {
              email: setUp.email,
              isActive: true,
              setupPending: false,
              role: "MANAGER",
            },
            current: {
              email: newEmail,
              isActive: false,
              setupPending: true,
              role: "MANAGER",
            },
            reason: expect.any(String),
          }
        );
      });

      it("S2: a role change sent with the email is recorded in current.role, previous.role keeps the old one", async () => {
        arrange(setUp);

        await updateStaff(
          "staff-1",
          { email: newEmail, role: "GENERAL_MANAGER" },
          "gm-1"
        );

        const [call] = actionCalls("STAFF_ACCESS_RESET");
        const details = call[4] as {
          previous: { role: string };
          current: { role: string };
        };
        expect(details.previous.role).toBe("MANAGER");
        expect(details.current.role).toBe("GENERAL_MANAGER");
      });

      it("S2: writes no STAFF_DEACTIVATED entry for a reset", async () => {
        arrange(setUp);

        await updateStaff("staff-1", { email: newEmail }, "gm-1");

        expect(actionCalls("STAFF_DEACTIVATED")).toHaveLength(0);
      });

      it("S3: a deactivated set-up account resets the same way and records isActive false as previous", async () => {
        const deactivated = { ...setUp, isActive: false };
        arrange(deactivated);

        await updateStaff("staff-1", { email: newEmail }, "gm-1");

        expect(mockUserUpdate).toHaveBeenCalledWith({
          where: { id: "staff-1", setupPending: false },
          data: {
            email: newEmail,
            password: RESET_HASH,
            tokenVersion: { increment: 1 },
            setupPending: true,
            isActive: false,
          },
          select: expect.any(Object),
        });
        expect(createAuditLog).toHaveBeenCalledWith(
          "gm-1",
          "STAFF_ACCESS_RESET",
          "STAFF",
          "staff-1",
          expect.objectContaining({
            previous: {
              email: setUp.email,
              isActive: false,
              setupPending: false,
              role: "MANAGER",
            },
          })
        );
      });

      it("a role change sent with the email still applies and is audited", async () => {
        arrange(setUp);

        await updateStaff(
          "staff-1",
          { email: newEmail, role: "GENERAL_MANAGER" },
          "gm-1"
        );

        const arg = mockUserUpdate.mock.calls[0][0];
        expect(arg.data).toEqual({
          email: newEmail,
          role: "GENERAL_MANAGER",
          password: RESET_HASH,
          tokenVersion: { increment: 1 },
          setupPending: true,
          isActive: false,
        });
        expect(actionCalls("STAFF_ROLE_CHANGED")).toHaveLength(1);
        expect(actionCalls("STAFF_ACCESS_RESET")).toHaveLength(1);
      });

      it("revokes the new email once, and hashes the placeholder after the spend and revoke, before the transaction", async () => {
        arrange(setUp);

        await updateStaff("staff-1", { email: newEmail }, "gm-1");

        expect(mockHash).toHaveBeenCalledTimes(1);
        expect(mockRevokeTrustedDevices).toHaveBeenCalledTimes(1);
        expect(mockRevokeTrustedDevices.mock.calls[0][0]).toBe(newEmail);
        const spend = mockInviteGlobalLimit.mock.invocationCallOrder[0];
        const revoke = mockRevokeTrustedDevices.mock.invocationCallOrder[0];
        const hash = mockHash.mock.invocationCallOrder[0];
        const tx = mockTransaction.mock.invocationCallOrder[0];
        expect(spend).toBeLessThan(revoke);
        expect(revoke).toBeLessThan(hash);
        expect(hash).toBeLessThan(tx);
      });

      it("a revoke error aborts the reset before any hash, transaction or write", async () => {
        arrange(setUp);
        mockRevokeTrustedDevices.mockRejectedValue(new Error("redis down"));

        await expect(
          updateStaff("staff-1", { email: newEmail }, "gm-1")
        ).rejects.toThrow("redis down");

        expect(mockHash).not.toHaveBeenCalled();
        expect(mockTransaction).not.toHaveBeenCalled();
        expect(mockUserUpdate).not.toHaveBeenCalled();
        expect(createAuditLog).not.toHaveBeenCalled();
      });

      it.each([
        ["isActive: false", false],
        ["isActive: true", true],
      ])(
        "S6: an email change with %s is refused before any spend, revoke, hash or write",
        async (_label, isActive) => {
          mockUserFindUnique.mockResolvedValueOnce(setUp);

          const error = await updateStaff(
            "staff-1",
            { email: newEmail, isActive },
            "gm-1"
          ).catch((e: unknown) => e);

          expect(error).toBeInstanceOf(BusinessRuleError);
          expect((error as Error).message).toBe(MIXED_MESSAGE);
          expect(mockUserFindUnique).toHaveBeenCalledTimes(1); // existing row only, no conflict lookup
          expect(mockGetStaffInviteRateLimiter).not.toHaveBeenCalled();
          expect(mockInviteLimit).not.toHaveBeenCalled();
          expect(mockInviteGlobalLimit).not.toHaveBeenCalled();
          expect(mockRevokeTrustedDevices).not.toHaveBeenCalled();
          expect(mockHash).not.toHaveBeenCalled();
          expect(mockTransaction).not.toHaveBeenCalled();
          expect(mockUserUpdate).not.toHaveBeenCalled();
          expect(createAuditLog).not.toHaveBeenCalled();
        }
      );

      it("S6: the mixed refusal comes before the recipient-allowlist check", async () => {
        process.env.INVITE_DOMAIN_ALLOWLIST = "hotel.test";
        mockUserFindUnique.mockResolvedValueOnce(setUp);

        await expect(
          updateStaff(
            "staff-1",
            { email: "someone@elsewhere.example", isActive: false },
            "gm-1"
          )
        ).rejects.toThrow(BusinessRuleError);
      });

      describe("conditional write (account changed while editing)", () => {
        const staleMessage = "This account changed while you were editing. Try again.";
        const p2025 = () =>
          new Prisma.PrismaClientKnownRequestError("No record", {
            code: "P2025",
            clientVersion: "x",
          });

        it.each([
          ["a reset", setUp, { email: newEmail }, false],
          [
            "a pending account's email change",
            createMockStaff({
              id: "staff-1",
              email: "wrong.person@sconewillowtree.com",
              isActive: false,
              setupPending: true,
            }),
            { email: newEmail },
            true,
          ],
          ["a plain name edit", setUp, { firstName: "Johnny" }, false],
        ])("%s carries setupPending in the update where", async (_l, row, input, pending) => {
          mockUserFindUnique
            .mockResolvedValueOnce(row)
            .mockResolvedValueOnce(null);
          mockUserUpdate.mockResolvedValue(row);

          await updateStaff("staff-1", input, "gm-1");

          expect(mockUserUpdate.mock.calls[0][0].where).toEqual({
            id: "staff-1",
            setupPending: pending,
          });
        });

        it("P2025 from the update becomes a ConflictError and writes no audit entry", async () => {
          arrange(setUp);
          mockUserUpdate.mockRejectedValue(p2025());

          const error = await updateStaff(
            "staff-1",
            { email: newEmail },
            "gm-1"
          ).catch((e: unknown) => e);

          expect(error).toBeInstanceOf(ConflictError);
          expect((error as Error).message).toBe(staleMessage);
          expect(createAuditLog).not.toHaveBeenCalled();
        });

        it("any other error passes through unchanged", async () => {
          arrange(setUp);
          const boom = new Error("db down");
          mockUserUpdate.mockRejectedValue(boom);

          await expect(
            updateStaff("staff-1", { email: newEmail }, "gm-1")
          ).rejects.toBe(boom);
          expect(createAuditLog).not.toHaveBeenCalled();
        });

        it("a Prisma error with another code passes through unchanged", async () => {
          arrange(setUp);
          const other = new Prisma.PrismaClientKnownRequestError("Unique", {
            code: "P2002",
            clientVersion: "x",
          });
          mockUserUpdate.mockRejectedValue(other);

          await expect(
            updateStaff("staff-1", { email: newEmail }, "gm-1")
          ).rejects.toBe(other);
        });
      });

      it("S4 (guard): a pending account's email change only voids tokens: no reset fields, no hash", async () => {
        const pending = createMockStaff({
          id: "staff-1",
          email: "wrong.person@sconewillowtree.com",
          isActive: false,
          setupPending: true,
        });
        arrange(pending);

        await updateStaff("staff-1", { email: newEmail }, "gm-1");

        expect(mockHash).not.toHaveBeenCalled();
        expect(mockUserUpdate).toHaveBeenCalledWith({
          where: { id: "staff-1", setupPending: true },
          data: { email: newEmail },
          select: expect.any(Object),
        });
        expect(mockVoidActiveTokens).toHaveBeenCalledTimes(2);
        expect(actionCalls("STAFF_ACCESS_RESET")).toHaveLength(0);
      });

      it("S5 (guard): the caller's own email change does not reset", async () => {
        const self = { ...setUp, id: "gm-1", role: "GENERAL_MANAGER" as const };
        mockUserFindUnique
          .mockResolvedValueOnce(self)
          .mockResolvedValueOnce(null);
        mockUserUpdate.mockResolvedValue({ ...self, email: newEmail });

        await updateStaff("gm-1", { email: newEmail }, "gm-1");

        expect(mockHash).not.toHaveBeenCalled();
        expect(mockUserUpdate).toHaveBeenCalledWith({
          where: { id: "gm-1", setupPending: false },
          data: { email: newEmail },
          select: expect.any(Object),
        });
        expect(actionCalls("STAFF_ACCESS_RESET")).toHaveLength(0);
      });

      it.each([
        ["a case-only edit", "WRONG.Person@SconeWillowTree.com"],
        ["a case-and-whitespace edit", "  Wrong.Person@sconewillowtree.com "],
      ])("guard: %s does not reset", async (_label, edited) => {
        // existing row, then an empty conflict lookup on the raw edited string
        mockUserFindUnique
          .mockResolvedValueOnce(setUp)
          .mockResolvedValueOnce(null);
        mockUserUpdate.mockResolvedValue(setUp);

        await updateStaff("staff-1", { email: edited }, "gm-1");

        expect(mockHash).not.toHaveBeenCalled();
        const data = mockUserUpdate.mock.calls[0][0].data;
        expect(data).not.toHaveProperty("password");
        expect(data).not.toHaveProperty("tokenVersion");
        expect(data).not.toHaveProperty("setupPending");
        expect(data).not.toHaveProperty("isActive");
        expect(actionCalls("STAFF_ACCESS_RESET")).toHaveLength(0);
      });

      it.each([
        ["a name edit", { firstName: "Johnny" }],
        ["a role edit", { role: "GENERAL_MANAGER" as const }],
      ])("guard: %s does not reset or touch tokenVersion", async (_label, input) => {
        mockUserFindUnique.mockResolvedValue(setUp);
        mockUserUpdate.mockResolvedValue(setUp);

        await updateStaff("staff-1", input, "gm-1");

        expect(mockHash).not.toHaveBeenCalled();
        const data = mockUserUpdate.mock.calls[0][0].data;
        expect(data).not.toHaveProperty("password");
        expect(data).not.toHaveProperty("tokenVersion");
        expect(data).not.toHaveProperty("setupPending");
        expect(actionCalls("STAFF_ACCESS_RESET")).toHaveLength(0);
      });
    });

    describe("email change spends the invite limits", () => {
      const newEmail = "new.email@sconewillowtree.com";
      const EMAIL_LIMIT_MESSAGE = "Too many email changes. Try again later.";
      const originalAllowlist = process.env.INVITE_DOMAIN_ALLOWLIST;

      beforeEach(() => {
        delete process.env.INVITE_DOMAIN_ALLOWLIST;
      });

      afterEach(() => {
        if (originalAllowlist === undefined) {
          delete process.env.INVITE_DOMAIN_ALLOWLIST;
        } else {
          process.env.INVITE_DOMAIN_ALLOWLIST = originalAllowlist;
        }
      });

      function arrangeEmailChange(row = existingStaff) {
        mockUserFindUnique
          .mockResolvedValueOnce(row)
          .mockResolvedValueOnce(null);
        mockUserUpdate.mockResolvedValue({ ...row, email: newEmail });
      }

      it("E1: spends the per-GM limit keyed by currentUserId, then the global limit", async () => {
        arrangeEmailChange();

        await updateStaff("staff-1", { email: newEmail }, "gm-1");

        expect(mockInviteLimit).toHaveBeenCalledTimes(1);
        expect(mockInviteLimit).toHaveBeenCalledWith("gm-1");
        expect(mockInviteGlobalLimit).toHaveBeenCalledTimes(1);
        expect(mockInviteGlobalLimit).toHaveBeenCalledWith("global");
        expect(mockTransaction).toHaveBeenCalledTimes(1);
      });

      it("E1: spends after the email-conflict lookup and before the transaction", async () => {
        arrangeEmailChange();

        await updateStaff("staff-1", { email: newEmail }, "gm-1");

        const lookupOrder = mockUserFindUnique.mock.invocationCallOrder[1];
        const spendOrder = mockInviteLimit.mock.invocationCallOrder[0];
        const txOrder = mockTransaction.mock.invocationCallOrder[0];
        expect(lookupOrder).toBeLessThan(spendOrder);
        expect(spendOrder).toBeLessThan(txOrder);
      });

      it("E2: per-GM refusal throws RateLimitError: no transaction, no write, no audit, global untouched", async () => {
        arrangeEmailChange();
        mockInviteLimit.mockResolvedValue({ success: false });

        const result = updateStaff("staff-1", { email: newEmail }, "gm-1");

        await expect(result).rejects.toThrow(RateLimitError);
        await expect(result).rejects.toMatchObject({
          message: EMAIL_LIMIT_MESSAGE,
        });
        expect(mockInviteGlobalLimit).not.toHaveBeenCalled();
        expect(mockTransaction).not.toHaveBeenCalled();
        expect(mockUserUpdate).not.toHaveBeenCalled();
        expect(mockVoidActiveTokens).not.toHaveBeenCalled();
        expect(createAuditLog).not.toHaveBeenCalled();
      });

      it("E3: global refusal throws RateLimitError: no transaction, no write, no audit", async () => {
        arrangeEmailChange();
        mockInviteGlobalLimit.mockResolvedValue({ success: false });

        const result = updateStaff("staff-1", { email: newEmail }, "gm-1");

        await expect(result).rejects.toThrow(RateLimitError);
        await expect(result).rejects.toMatchObject({
          message: EMAIL_LIMIT_MESSAGE,
        });
        expect(mockInviteLimit).toHaveBeenCalledWith("gm-1");
        expect(mockTransaction).not.toHaveBeenCalled();
        expect(mockUserUpdate).not.toHaveBeenCalled();
        expect(createAuditLog).not.toHaveBeenCalled();
      });

      it.each([
        ["identical", "john.doe@sconewillowtree.com"],
        ["case-only", "John.Doe@SconeWillowTree.com"],
      ])("E4: %s email spends no limit", async (_label, sameEmail) => {
        // A case-only diff still reaches the conflict lookup, which finds nothing.
        mockUserFindUnique
          .mockResolvedValueOnce(existingStaff)
          .mockResolvedValue(null);
        mockUserUpdate.mockResolvedValue(existingStaff);

        await updateStaff("staff-1", { email: sameEmail }, "gm-1");

        expect(mockInviteLimit).not.toHaveBeenCalled();
        expect(mockInviteGlobalLimit).not.toHaveBeenCalled();
      });

      it("E4: a non-email update spends no limit", async () => {
        mockUserFindUnique.mockResolvedValue(existingStaff);
        mockUserUpdate.mockResolvedValue(existingStaff);

        await updateStaff("staff-1", { firstName: "Johnny" }, "gm-1");

        expect(mockInviteLimit).not.toHaveBeenCalled();
        expect(mockInviteGlobalLimit).not.toHaveBeenCalled();
      });

      it("E5: allowlist refusal spends no limit", async () => {
        process.env.INVITE_DOMAIN_ALLOWLIST = "hotel.test";
        mockUserFindUnique.mockResolvedValueOnce(existingStaff);

        await expect(
          updateStaff("staff-1", { email: "x@evil.example" }, "gm-1")
        ).rejects.toThrow(ValidationError);

        expect(mockInviteLimit).not.toHaveBeenCalled();
        expect(mockInviteGlobalLimit).not.toHaveBeenCalled();
      });

      it("E5: email conflict spends no limit", async () => {
        mockUserFindUnique
          .mockResolvedValueOnce(existingStaff)
          .mockResolvedValueOnce(createMockStaff({ id: "staff-2", email: newEmail }));

        await expect(
          updateStaff("staff-1", { email: newEmail }, "gm-1")
        ).rejects.toThrow(ConflictError);

        expect(mockInviteLimit).not.toHaveBeenCalled();
        expect(mockInviteGlobalLimit).not.toHaveBeenCalled();
      });

      it("E6: a GM changing their own email spends their own bucket", async () => {
        const gm = createMockStaff({
          id: "gm-1",
          role: "GENERAL_MANAGER",
          email: "gm@sconewillowtree.com",
        });
        arrangeEmailChange(gm);

        await updateStaff("gm-1", { email: newEmail }, "gm-1");

        expect(mockInviteLimit).toHaveBeenCalledWith("gm-1");
        expect(mockInviteGlobalLimit).toHaveBeenCalledWith("global");
      });

      it("skips the spend when both limiters are unconfigured", async () => {
        mockGetStaffInviteRateLimiter.mockReturnValue(null);
        mockGetStaffInviteGlobalRateLimiter.mockReturnValue(null);
        arrangeEmailChange();

        await updateStaff("staff-1", { email: newEmail }, "gm-1");

        expect(mockTransaction).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ============================================================
  // deleteStaff
  // ============================================================
  describe("deleteStaff", () => {
    it("should delete staff member when they have no bookings", async () => {
      const staffWithNoBookings = {
        ...createMockStaff({ id: "staff-1" }),
        _count: { bookings: 0 },
      };
      mockUserFindUnique.mockResolvedValue(staffWithNoBookings);
      mockUserDelete.mockResolvedValue(undefined);

      const result = await deleteStaff("staff-1", "current-user-id");

      expect(mockUserFindUnique).toHaveBeenCalledWith({
        where: { id: "staff-1" },
        include: { _count: { select: { bookings: true } } },
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

    it("should deactivate staff member when they have bookings", async () => {
      const staffWithBookings = {
        ...createMockStaff({ id: "staff-1" }),
        _count: { bookings: 2 },
      };
      mockUserFindUnique.mockResolvedValue(staffWithBookings);
      mockUserUpdate.mockResolvedValue({ ...staffWithBookings, isActive: false });

      const result = await deleteStaff("staff-1", "current-user-id");

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "staff-1" },
        data: { isActive: false, tokenVersion: { increment: 1 } },
      });
      expect(mockUserDelete).not.toHaveBeenCalled();
      expect(result).toEqual({
        deleted: false,
        deactivated: true,
        message: "Staff deactivated (has bookings)",
      });
    });

    it("S10: the deactivate branch revokes the account's devices before the update", async () => {
      const staffWithBookings = {
        ...createMockStaff({ id: "staff-1" }),
        _count: { bookings: 1 },
      };
      mockUserFindUnique.mockResolvedValue(staffWithBookings);
      mockUserUpdate.mockResolvedValue({ ...staffWithBookings, isActive: false });

      await deleteStaff("staff-1", "current-user-id");

      expect(mockRevokeTrustedDevices).toHaveBeenCalledTimes(1);
      expect(mockRevokeTrustedDevices.mock.calls[0][0]).toBe(
        staffWithBookings.email
      );
      expect(mockRevokeTrustedDevices.mock.invocationCallOrder[0]).toBeLessThan(
        mockUserUpdate.mock.invocationCallOrder[0]
      );
    });

    it("S10: a revoke error in the deactivate branch aborts with no write", async () => {
      mockUserFindUnique.mockResolvedValue({
        ...createMockStaff({ id: "staff-1" }),
        _count: { bookings: 1 },
      });
      mockRevokeTrustedDevices.mockRejectedValue(new Error("redis down"));

      await expect(deleteStaff("staff-1", "current-user-id")).rejects.toThrow(
        "redis down"
      );

      expect(mockUserUpdate).not.toHaveBeenCalled();
      expect(mockUserDelete).not.toHaveBeenCalled();
    });

    describe("deactivating a pending (reset) account", () => {
      const pendingWithBookings = () => ({
        ...createMockStaff({
          id: "staff-1",
          isActive: false,
          setupPending: true,
        }),
        _count: { bookings: 1 },
      });

      it("voids SETUP and RESET tokens then deactivates without touching setupPending, in one transaction", async () => {
        const row = pendingWithBookings();
        mockUserFindUnique.mockResolvedValue(row);
        mockUserUpdate.mockResolvedValue({ ...row, setupPending: false });

        const result = await deleteStaff("staff-1", "gm-1");

        expect(mockTransaction).toHaveBeenCalledTimes(1);
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
        expect(mockVoidActiveTokens).toHaveBeenCalledTimes(2);
        expect(mockTxUserUpdate).toHaveBeenCalledTimes(1);
        expect(mockTxUserUpdate).toHaveBeenCalledWith({
          where: { id: "staff-1" },
          data: { isActive: false, tokenVersion: { increment: 1 } },
        });
        expect(
          Math.max(...mockVoidActiveTokens.mock.invocationCallOrder)
        ).toBeLessThan(mockTxUserUpdate.mock.invocationCallOrder[0]);
        expect(mockUserDelete).not.toHaveBeenCalled();
        expect(result.deactivated).toBe(true);
      });

      it("revokes trusted devices before the transaction and writes the STAFF_DEACTIVATED audit", async () => {
        const row = pendingWithBookings();
        mockUserFindUnique.mockResolvedValue(row);
        mockUserUpdate.mockResolvedValue(row);

        await deleteStaff("staff-1", "gm-1");

        expect(mockRevokeTrustedDevices).toHaveBeenCalledTimes(1);
        expect(mockRevokeTrustedDevices.mock.calls[0][0]).toBe(row.email);
        expect(mockRevokeTrustedDevices.mock.invocationCallOrder[0]).toBeLessThan(
          mockTransaction.mock.invocationCallOrder[0]
        );
        expect(createAuditLog).toHaveBeenCalledTimes(1);
        expect(createAuditLog).toHaveBeenCalledWith(
          "gm-1",
          "STAFF_DEACTIVATED",
          "STAFF",
          "staff-1",
          {
            reason: "Deactivated instead of deleted (has bookings)",
            current: { isActive: false, bookings: 1 },
          }
        );
      });

      it("writes a STAFF_TOKENS_VOIDED audit when the voids cancelled a link", async () => {
        const row = pendingWithBookings();
        mockUserFindUnique.mockResolvedValue(row);
        mockUserUpdate.mockResolvedValue(row);
        mockVoidActiveTokens.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

        await deleteStaff("staff-1", "gm-1");

        expect(createAuditLog).toHaveBeenCalledWith(
          "gm-1",
          "STAFF_TOKENS_VOIDED",
          "STAFF",
          "staff-1",
          expect.objectContaining({ reason: expect.any(String) })
        );
        expect(createAuditLog).toHaveBeenCalledWith(
          "gm-1",
          "STAFF_DEACTIVATED",
          "STAFF",
          "staff-1",
          expect.anything()
        );
      });

      it("counts both voids: a link cancelled only by the RESET void still audits", async () => {
        const row = pendingWithBookings();
        mockUserFindUnique.mockResolvedValue(row);
        mockUserUpdate.mockResolvedValue(row);
        mockVoidActiveTokens.mockResolvedValueOnce(0).mockResolvedValueOnce(2);

        await deleteStaff("staff-1", "gm-1");

        expect(createAuditLog).toHaveBeenCalledWith(
          "gm-1",
          "STAFF_TOKENS_VOIDED",
          "STAFF",
          "staff-1",
          expect.objectContaining({ reason: expect.any(String) })
        );
      });

      it("guard: no STAFF_TOKENS_VOIDED audit when nothing was voided", async () => {
        const row = pendingWithBookings();
        mockUserFindUnique.mockResolvedValue(row);
        mockUserUpdate.mockResolvedValue(row);
        mockVoidActiveTokens.mockResolvedValue(0);

        await deleteStaff("staff-1", "gm-1");

        expect(
          vi
            .mocked(createAuditLog)
            .mock.calls.filter((c) => c[1] === "STAFF_TOKENS_VOIDED")
        ).toHaveLength(0);
      });

      it("a revoke error aborts with no transaction, void or write", async () => {
        mockUserFindUnique.mockResolvedValue(pendingWithBookings());
        mockRevokeTrustedDevices.mockRejectedValue(new Error("redis down"));

        await expect(deleteStaff("staff-1", "gm-1")).rejects.toThrow(
          "redis down"
        );

        expect(mockTransaction).not.toHaveBeenCalled();
        expect(mockVoidActiveTokens).not.toHaveBeenCalled();
        expect(mockUserUpdate).not.toHaveBeenCalled();
        expect(createAuditLog).not.toHaveBeenCalled();
      });

      it("guard: a set-up account keeps the plain update with no voiding or transaction", async () => {
        const row = {
          ...createMockStaff({ id: "staff-1", setupPending: false }),
          _count: { bookings: 1 },
        };
        mockUserFindUnique.mockResolvedValue(row);
        mockUserUpdate.mockResolvedValue(row);

        await deleteStaff("staff-1", "gm-1");

        expect(mockUserUpdate).toHaveBeenCalledWith({
          where: { id: "staff-1" },
          data: { isActive: false, tokenVersion: { increment: 1 } },
        });
        expect(mockTransaction).not.toHaveBeenCalled();
        expect(mockVoidActiveTokens).not.toHaveBeenCalled();
      });

      it("guard: a set-up account's revoke error aborts with no write", async () => {
        mockUserFindUnique.mockResolvedValue({
          ...createMockStaff({ id: "staff-1", setupPending: false }),
          _count: { bookings: 1 },
        });
        mockRevokeTrustedDevices.mockRejectedValue(new Error("redis down"));

        await expect(deleteStaff("staff-1", "gm-1")).rejects.toThrow(
          "redis down"
        );
        expect(mockUserUpdate).not.toHaveBeenCalled();
        expect(createAuditLog).not.toHaveBeenCalled();
      });
    });

    it("S10: the hard-delete branch does not revoke", async () => {
      mockUserFindUnique.mockResolvedValue({
        ...createMockStaff({ id: "staff-1" }),
        _count: { bookings: 0 },
      });
      mockUserDelete.mockResolvedValue(undefined);

      await deleteStaff("staff-1", "current-user-id");

      expect(mockUserDelete).toHaveBeenCalled();
      expect(mockRevokeTrustedDevices).not.toHaveBeenCalled();
    });

    it("deactivates (does not delete) when every booking is CHECKED_OUT or CANCELLED", async () => {
      const row = {
        ...createMockStaff({ id: "staff-1" }),
        _count: { bookings: 2 },
      };
      mockUserFindUnique.mockResolvedValue(row);
      mockUserUpdate.mockResolvedValue({ ...row, isActive: false });

      const result = await deleteStaff("staff-1", "current-user-id");

      // Counts every booking, whatever its status: no status filter in the lookup.
      expect(mockUserFindUnique).toHaveBeenCalledWith({
        where: { id: "staff-1" },
        include: { _count: { select: { bookings: true } } },
      });
      expect(mockUserDelete).not.toHaveBeenCalled();
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "staff-1" },
        data: { isActive: false, tokenVersion: { increment: 1 } },
      });
      expect(result).toEqual({
        deleted: false,
        deactivated: true,
        message: "Staff deactivated (has bookings)",
      });
    });

    it("the deactivate audit records the booking count under the bookings key", async () => {
      const row = {
        ...createMockStaff({ id: "staff-1" }),
        _count: { bookings: 2 },
      };
      mockUserFindUnique.mockResolvedValue(row);
      mockUserUpdate.mockResolvedValue(row);

      await deleteStaff("staff-1", "gm-1");

      expect(createAuditLog).toHaveBeenCalledWith(
        "gm-1",
        "STAFF_DEACTIVATED",
        "STAFF",
        "staff-1",
        {
          reason: "Deactivated instead of deleted (has bookings)",
          current: { isActive: false, bookings: 2 },
        }
      );
    });

    it("hard-deletes and audits STAFF_DELETED when there are no bookings at all", async () => {
      mockUserFindUnique.mockResolvedValue({
        ...createMockStaff({ id: "staff-1" }),
        _count: { bookings: 0 },
      });
      mockUserDelete.mockResolvedValue(undefined);

      const result = await deleteStaff("staff-1", "current-user-id");

      expect(mockUserDelete).toHaveBeenCalled();
      expect(mockUserUpdate).not.toHaveBeenCalled();
      expect(result.deleted).toBe(true);
      expect(createAuditLog).toHaveBeenCalledWith(
        "current-user-id",
        "STAFF_DELETED",
        "STAFF",
        "staff-1",
        expect.anything()
      );
    });

    describe("delete races a new booking", () => {
      const zeroBookings = () => ({
        ...createMockStaff({ id: "staff-1" }),
        _count: { bookings: 0 },
      });

      it("P2003 from the delete becomes a ConflictError and writes no STAFF_DELETED audit", async () => {
        mockUserFindUnique.mockResolvedValue(zeroBookings());
        mockUserDelete.mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError("FK", {
            code: "P2003",
            clientVersion: "x",
          })
        );

        const error = await deleteStaff("staff-1", "gm-1").catch(
          (e: unknown) => e
        );

        expect(error).toBeInstanceOf(ConflictError);
        expect((error as Error).message).toBe(
          "This staff member now has bookings. Try again."
        );
        expect(createAuditLog).not.toHaveBeenCalled();
      });

      it("any other error from the delete is rethrown unchanged", async () => {
        mockUserFindUnique.mockResolvedValue(zeroBookings());
        const boom = new Error("db down");
        mockUserDelete.mockRejectedValue(boom);

        await expect(deleteStaff("staff-1", "gm-1")).rejects.toBe(boom);
        expect(createAuditLog).not.toHaveBeenCalled();
      });

      it("a Prisma error with another code is rethrown unchanged", async () => {
        mockUserFindUnique.mockResolvedValue(zeroBookings());
        const other = new Prisma.PrismaClientKnownRequestError("Missing", {
          code: "P2025",
          clientVersion: "x",
        });
        mockUserDelete.mockRejectedValue(other);

        await expect(deleteStaff("staff-1", "gm-1")).rejects.toBe(other);
        expect(createAuditLog).not.toHaveBeenCalled();
      });
    });
  });
});
