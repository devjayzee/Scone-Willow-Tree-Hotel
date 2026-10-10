import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setupMocks,
  resetMocks,
  mockUserFindUnique,
  mockUserCreate,
  mockIssueSetupTokenForUser,
  mockInviteLimit,
  mockGetStaffInviteRateLimiter,
  mockInviteGlobalLimit,
  mockEmailSend,
  mockLoggerError,
} from "./test-utils";
import { createAuditLog } from "@/lib/services/audit-service";
import {
  ValidationError,
  RateLimitError,
  ConflictError,
} from "@/lib/errors";

// Setup mocks before importing services
setupMocks();

// Imported from the index so the path stays stable when resendInvite moves.
import {
  inviteStaff,
  resendInvite,
  NotFoundError,
  BusinessRuleError,
} from "@/lib/services/staff";

const ALLOWLIST_MESSAGE =
  "Recipient email domain is not allowed on this deployment.";
const LIMIT_MESSAGE = "Too many staff invites. Try again later.";

const pendingInvitee = (email = "invitee@hotel.test") => ({
  id: "u1",
  email,
  firstName: "Ivy",
  isActive: false,
  setupPending: true,
});

describe("Staff invites", () => {
  const originalAllowlist = process.env.INVITE_DOMAIN_ALLOWLIST;
  const deferSend = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
    deferSend.mockReset();
    process.env.INVITE_DOMAIN_ALLOWLIST = "hotel.test";
  });

  afterEach(() => {
    if (originalAllowlist === undefined) {
      delete process.env.INVITE_DOMAIN_ALLOWLIST;
    } else {
      process.env.INVITE_DOMAIN_ALLOWLIST = originalAllowlist;
    }
  });

  const runDeferred = async () => {
    const task = deferSend.mock.calls[0][0] as () => Promise<void>;
    await task();
  };

  // ============================================================
  // inviteStaff
  // ============================================================
  describe("inviteStaff", () => {
    const input = {
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@hotel.test",
      role: "STAFF" as const,
    };
    const created = {
      id: "new-staff",
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@hotel.test",
      role: "STAFF",
    };

    beforeEach(() => {
      mockUserFindUnique.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue(created);
      mockIssueSetupTokenForUser.mockResolvedValue("raw-setup-token");
    });

    it("T8: creates the staff, defers one send, and the task mails the invite to the staff email", async () => {
      const result = await inviteStaff(input, "gm-1", deferSend);

      expect(result).toEqual(created);
      expect(mockUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: "jane@hotel.test",
            firstName: "Jane",
            lastName: "Smith",
            setupPending: true,
          }),
        })
      );
      expect(deferSend).toHaveBeenCalledTimes(1);
      expect(mockEmailSend).not.toHaveBeenCalled();

      await runDeferred();

      expect(mockEmailSend).toHaveBeenCalledTimes(1);
      const sent = mockEmailSend.mock.calls[0][0];
      expect(sent.to).toBe("jane@hotel.test");
      expect(sent.subject).toEqual(expect.any(String));
      expect(sent.text).toContain("Hi Jane");
      expect(sent.text).toContain("raw-setup-token");
      expect(sent.html).toContain("raw-setup-token");
    });

    it("T8: logs and swallows a mail failure in the deferred task", async () => {
      const mailError = new Error("smtp down");
      mockEmailSend.mockRejectedValue(mailError);

      await inviteStaff(input, "gm-1", deferSend);
      expect(mockLoggerError).not.toHaveBeenCalled();

      await expect(runDeferred()).resolves.toBeUndefined();

      expect(mockLoggerError).toHaveBeenCalledTimes(1);
      expect(mockLoggerError).toHaveBeenCalledWith(
        "Failed to send staff invite email",
        mailError,
        { staffId: "new-staff" }
      );
    });

    it("T6: refuses a recipient outside the allowlist before the limiter: nothing created, no email", async () => {
      const result = inviteStaff(
        { ...input, email: "attacker@evil.example" },
        "gm-1",
        deferSend
      );

      await expect(result).rejects.toThrow(ValidationError);
      await expect(result).rejects.toMatchObject({ message: ALLOWLIST_MESSAGE });
      expect(mockInviteLimit).not.toHaveBeenCalled();
      expect(mockUserCreate).not.toHaveBeenCalled();
      expect(deferSend).not.toHaveBeenCalled();
    });

    it("T7: refuses past the limit: nothing created, no email", async () => {
      mockInviteLimit.mockResolvedValue({ success: false });

      const result = inviteStaff(input, "gm-1", deferSend);

      await expect(result).rejects.toThrow(RateLimitError);
      await expect(result).rejects.toMatchObject({ message: LIMIT_MESSAGE });
      expect(mockUserCreate).not.toHaveBeenCalled();
      expect(mockIssueSetupTokenForUser).not.toHaveBeenCalled();
      expect(deferSend).not.toHaveBeenCalled();
      expect(mockEmailSend).not.toHaveBeenCalled();
    });

    it("T3: spends the invite limiter keyed by the GM's id", async () => {
      await inviteStaff(input, "gm-1", deferSend);

      expect(mockInviteLimit).toHaveBeenCalledTimes(1);
      expect(mockInviteLimit).toHaveBeenCalledWith("gm-1");
    });

    it("spends the global bucket (key 'global') after the per-GM one", async () => {
      await inviteStaff(input, "gm-1", deferSend);

      expect(mockInviteGlobalLimit).toHaveBeenCalledTimes(1);
      expect(mockInviteGlobalLimit).toHaveBeenCalledWith("global");
      expect(mockInviteLimit.mock.invocationCallOrder[0]).toBeLessThan(
        mockInviteGlobalLimit.mock.invocationCallOrder[0]
      );
    });

    it("refuses past the global limit: nothing created, no email", async () => {
      mockInviteGlobalLimit.mockResolvedValue({ success: false });

      const result = inviteStaff(input, "gm-1", deferSend);

      await expect(result).rejects.toThrow(RateLimitError);
      await expect(result).rejects.toMatchObject({ message: LIMIT_MESSAGE });
      expect(mockInviteLimit).toHaveBeenCalledWith("gm-1");
      expect(mockUserCreate).not.toHaveBeenCalled();
      expect(mockIssueSetupTokenForUser).not.toHaveBeenCalled();
      expect(deferSend).not.toHaveBeenCalled();
      expect(mockEmailSend).not.toHaveBeenCalled();
    });

    it("rejects a duplicate email with ConflictError after the limiter is spent: nothing created, no email", async () => {
      mockUserFindUnique.mockResolvedValue({
        id: "existing",
        email: input.email,
      });

      await expect(inviteStaff(input, "gm-1", deferSend)).rejects.toThrow(
        ConflictError
      );

      expect(mockInviteLimit).toHaveBeenCalledTimes(1);
      expect(mockInviteLimit).toHaveBeenCalledWith("gm-1");
      expect(mockUserCreate).not.toHaveBeenCalled();
      expect(mockIssueSetupTokenForUser).not.toHaveBeenCalled();
      expect(deferSend).not.toHaveBeenCalled();
    });

    it("skips the per-GM limit when it is unconfigured (global still spends)", async () => {
      mockGetStaffInviteRateLimiter.mockReturnValue(null);

      await inviteStaff(input, "gm-1", deferSend);

      expect(mockInviteLimit).not.toHaveBeenCalled();
      expect(mockInviteGlobalLimit).toHaveBeenCalledTimes(1);
      expect(mockInviteGlobalLimit).toHaveBeenCalledWith("global");
      expect(mockUserCreate).toHaveBeenCalledTimes(1);
      expect(deferSend).toHaveBeenCalledTimes(1);
    });

    it("T12: allows any domain when the allowlist is unset", async () => {
      delete process.env.INVITE_DOMAIN_ALLOWLIST;

      await inviteStaff(
        { ...input, email: "anyone@anywhere.example" },
        "gm-1",
        deferSend
      );

      expect(mockUserCreate).toHaveBeenCalledTimes(1);
      expect(deferSend).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // resendInvite (moved from staff-mutations.test.ts)
  // ============================================================
  describe("resendInvite", () => {
    it("T9: issues a fresh token, audits STAFF_INVITE_RESENT and defers one send", async () => {
      mockUserFindUnique.mockResolvedValue(pendingInvitee());
      mockIssueSetupTokenForUser.mockResolvedValue("fresh-token");

      const result = await resendInvite("u1", "manager-1", deferSend);

      expect(result).toBeUndefined();
      expect(mockUserFindUnique).toHaveBeenCalledWith({
        where: { id: "u1" },
        select: expect.objectContaining({ setupPending: true }),
      });
      expect(mockIssueSetupTokenForUser).toHaveBeenCalledWith("u1");
      expect(createAuditLog).toHaveBeenCalledWith(
        "manager-1",
        "STAFF_INVITE_RESENT",
        "STAFF",
        "u1",
        expect.any(Object)
      );
      expect(deferSend).toHaveBeenCalledTimes(1);
      expect(mockEmailSend).not.toHaveBeenCalled();

      await runDeferred();

      expect(mockEmailSend).toHaveBeenCalledTimes(1);
      const sent = mockEmailSend.mock.calls[0][0];
      expect(sent.to).toBe("invitee@hotel.test");
      expect(sent.text).toContain("Hi Ivy");
      expect(sent.text).toContain("fresh-token");
    });

    it("logs and swallows a mail failure in the deferred task", async () => {
      mockUserFindUnique.mockResolvedValue(pendingInvitee());
      const mailError = new Error("smtp down");
      mockEmailSend.mockRejectedValue(mailError);

      await resendInvite("u1", "manager-1", deferSend);

      await expect(runDeferred()).resolves.toBeUndefined();
      expect(mockLoggerError).toHaveBeenCalledWith(
        "Failed to resend staff invite email",
        mailError,
        { staffId: "u1" }
      );
    });

    it("T1: refuses a pending invitee outside the allowlist: no token, audit or email", async () => {
      mockUserFindUnique.mockResolvedValue(
        pendingInvitee("attacker@evil.example")
      );

      const result = resendInvite("u1", "manager-1", deferSend);

      await expect(result).rejects.toThrow(ValidationError);
      await expect(result).rejects.toMatchObject({ message: ALLOWLIST_MESSAGE });
      expect(mockIssueSetupTokenForUser).not.toHaveBeenCalled();
      expect(createAuditLog).not.toHaveBeenCalled();
      expect(deferSend).not.toHaveBeenCalled();
    });

    it("T2: refuses past the limit: no token, audit or email", async () => {
      mockUserFindUnique.mockResolvedValue(pendingInvitee());
      mockInviteLimit.mockResolvedValue({ success: false });

      const result = resendInvite("u1", "manager-1", deferSend);

      await expect(result).rejects.toThrow(RateLimitError);
      await expect(result).rejects.toMatchObject({ message: LIMIT_MESSAGE });
      expect(mockIssueSetupTokenForUser).not.toHaveBeenCalled();
      expect(createAuditLog).not.toHaveBeenCalled();
      expect(deferSend).not.toHaveBeenCalled();
      expect(mockEmailSend).not.toHaveBeenCalled();
    });

    it("T3: spends the same invite limiter, keyed by the GM's id", async () => {
      mockUserFindUnique.mockResolvedValue(pendingInvitee());

      await resendInvite("u1", "manager-1", deferSend);

      expect(mockGetStaffInviteRateLimiter).toHaveBeenCalled();
      expect(mockInviteLimit).toHaveBeenCalledTimes(1);
      expect(mockInviteLimit).toHaveBeenCalledWith("manager-1");
    });

    it("spends the global bucket (key 'global') after the per-GM one", async () => {
      mockUserFindUnique.mockResolvedValue(pendingInvitee());

      await resendInvite("u1", "manager-1", deferSend);

      expect(mockInviteGlobalLimit).toHaveBeenCalledTimes(1);
      expect(mockInviteGlobalLimit).toHaveBeenCalledWith("global");
      expect(mockInviteLimit.mock.invocationCallOrder[0]).toBeLessThan(
        mockInviteGlobalLimit.mock.invocationCallOrder[0]
      );
    });

    it("refuses past the global limit: no token, audit or email", async () => {
      mockUserFindUnique.mockResolvedValue(pendingInvitee());
      mockInviteGlobalLimit.mockResolvedValue({ success: false });

      const result = resendInvite("u1", "manager-1", deferSend);

      await expect(result).rejects.toThrow(RateLimitError);
      await expect(result).rejects.toMatchObject({ message: LIMIT_MESSAGE });
      expect(mockInviteLimit).toHaveBeenCalledWith("manager-1");
      expect(mockIssueSetupTokenForUser).not.toHaveBeenCalled();
      expect(createAuditLog).not.toHaveBeenCalled();
      expect(deferSend).not.toHaveBeenCalled();
      expect(mockEmailSend).not.toHaveBeenCalled();
    });

    it("allows resend when the allowlist is unset", async () => {
      delete process.env.INVITE_DOMAIN_ALLOWLIST;
      mockUserFindUnique.mockResolvedValue(
        pendingInvitee("anyone@anywhere.example")
      );

      await resendInvite("u1", "manager-1", deferSend);

      expect(mockIssueSetupTokenForUser).toHaveBeenCalledWith("u1");
      expect(deferSend).toHaveBeenCalledTimes(1);
    });

    it("throws NotFoundError for an unknown user", async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await expect(
        resendInvite("ghost", "manager-1", deferSend)
      ).rejects.toThrow(NotFoundError);
      expect(mockIssueSetupTokenForUser).not.toHaveBeenCalled();
      expect(deferSend).not.toHaveBeenCalled();
    });

    it("throws BusinessRuleError for an already-active staff member", async () => {
      mockUserFindUnique.mockResolvedValue({
        id: "u1",
        email: "active@hotel.test",
        firstName: "Ann",
        isActive: true,
        setupPending: false,
      });

      const result = resendInvite("u1", "manager-1", deferSend);
      await expect(result).rejects.toThrow(BusinessRuleError);
      await expect(result).rejects.toMatchObject({
        message:
          "Cannot resend invite: this staff member has already completed setup",
      });
      expect(mockIssueSetupTokenForUser).not.toHaveBeenCalled();
      expect(deferSend).not.toHaveBeenCalled();
    });

    it("refuses a deactivated user who completed setup: no token, no audit", async () => {
      mockUserFindUnique.mockResolvedValue({
        id: "u2",
        email: "exemployee@hotel.test",
        firstName: "Eve",
        isActive: false,
        setupPending: false,
      });

      const result = resendInvite("u2", "manager-1", deferSend);
      await expect(result).rejects.toThrow(BusinessRuleError);
      await expect(result).rejects.toMatchObject({
        message:
          "This account has been deactivated. Use Activate to restore access.",
      });
      expect(mockIssueSetupTokenForUser).not.toHaveBeenCalled();
      expect(createAuditLog).not.toHaveBeenCalled();
      expect(deferSend).not.toHaveBeenCalled();
    });

    describe("T10: refusals do not spend the limiter", () => {
      it.each([
        ["not found", null],
        [
          "not pending (active)",
          { id: "u1", email: "a@hotel.test", firstName: "A", isActive: true, setupPending: false },
        ],
        [
          "not pending (deactivated)",
          { id: "u1", email: "a@hotel.test", firstName: "A", isActive: false, setupPending: false },
        ],
        ["allowlist", pendingInvitee("attacker@evil.example")],
      ])("%s", async (_label, row) => {
        mockUserFindUnique.mockResolvedValue(row);

        await expect(
          resendInvite("u1", "manager-1", deferSend)
        ).rejects.toThrow();
        expect(mockInviteLimit).not.toHaveBeenCalled();
        expect(mockInviteGlobalLimit).not.toHaveBeenCalled();
      });
    });
  });
});
