import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { NotFoundError, RateLimitError } from "@/lib/errors";

const h = vi.hoisted(() => {
  const mockUserFindUnique = vi.fn();
  const mockUserUpdate = vi.fn();
  const mockTokenFindUnique = vi.fn();
  const mockTokenCreate = vi.fn();
  const mockTokenUpdateMany = vi.fn();
  const mockAuditLogCreate = vi.fn();

  const client = {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    passwordResetToken: {
      findUnique: (...args: unknown[]) => mockTokenFindUnique(...args),
      create: (...args: unknown[]) => mockTokenCreate(...args),
      updateMany: (...args: unknown[]) => mockTokenUpdateMany(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
  };

  // Handles both $transaction forms: array (sequential ops) and callback
  // (interactive). consumeToken uses the callback form so the atomic
  // single-use guard can throw and roll back.
  const mockTransaction = vi.fn(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: typeof client) => unknown)(client);
    }
    return Promise.all(arg as unknown[]);
  });

  return {
    mockUserFindUnique,
    mockUserUpdate,
    mockTokenFindUnique,
    mockTokenCreate,
    mockTokenUpdateMany,
    mockAuditLogCreate,
    mockTransaction,
    client,
  };
});

const {
  mockUserFindUnique,
  mockUserUpdate,
  mockTokenFindUnique,
  mockTokenCreate,
  mockTokenUpdateMany,
  mockAuditLogCreate,
  mockTransaction,
} = h;

vi.mock("@/lib/prisma", () => ({
  default: {
    ...h.client,
    $transaction: (arg: unknown) => h.mockTransaction(arg),
  },
}));

const mockLoggerError = vi.fn();

vi.mock("@/lib/logger", () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockRateLimit = vi.fn();
const mockGetForgotPasswordRateLimiter = vi.fn();

vi.mock("@/lib/services/rate-limit-service", () => ({
  getForgotPasswordRateLimiter: (...args: unknown[]) =>
    mockGetForgotPasswordRateLimiter(...args),
}));

const mockSend = vi.fn();

vi.mock("@/lib/email/email-transport", () => ({
  getEmailTransport: () => ({
    send: (...args: unknown[]) => mockSend(...args),
  }),
}));

import {
  hashToken,
  issueResetTokenForEmail,
  issueSetupTokenForUser,
  resolveSetupInvite,
  consumeResetToken,
  consumeSetupToken,
  requestPasswordReset,
  RESET_TOKEN_TTL_MINUTES,
  SETUP_TOKEN_TTL_HOURS,
} from "@/lib/services/password-reset-service";

const activeUser = {
  id: "u1",
  email: "jane@example.com",
  firstName: "Jane",
  isActive: true,
};

function validToken(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    tokenHash: hashToken("raw-token"),
    userId: "u1",
    purpose: "RESET",
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    createdAt: new Date(),
    user: {
      id: "u1",
      email: "jane@example.com",
      firstName: "Jane",
      role: "STAFF",
    },
    ...overrides,
  };
}

describe("Password Reset Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("hashToken", () => {
    it("is deterministic and returns 64 hex chars", () => {
      expect(hashToken("abc")).toBe(hashToken("abc"));
      expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/);
      expect(hashToken("abc")).not.toBe(hashToken("abd"));
    });
  });

  describe("issueResetTokenForEmail", () => {
    it("stores a hashed token and returns the raw token + user", async () => {
      mockUserFindUnique.mockResolvedValue(activeUser);

      const { emailedToken, user } = await issueResetTokenForEmail(
        "jane@example.com"
      );

      expect(emailedToken).toBeTruthy();
      expect(user).toEqual({
        id: "u1",
        email: "jane@example.com",
        firstName: "Jane",
      });
      const createArg = mockTokenCreate.mock.calls[0][0];
      expect(createArg.data.tokenHash).toBe(hashToken(emailedToken as string));
      expect(createArg.data.tokenHash).not.toBe(emailedToken);
      expect(createArg.data.purpose).toBe("RESET");
      const ttlMs =
        createArg.data.expiresAt.getTime() - Date.now();
      expect(ttlMs).toBeGreaterThan((RESET_TOKEN_TTL_MINUTES - 1) * 60_000);
      expect(ttlMs).toBeLessThanOrEqual(RESET_TOKEN_TTL_MINUTES * 60_000);
    });

    it("voids prior unused RESET tokens before inserting the new one", async () => {
      mockUserFindUnique.mockResolvedValue(activeUser);

      await issueResetTokenForEmail("jane@example.com");

      expect(mockTokenUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "u1",
            purpose: "RESET",
            usedAt: null,
          }),
          data: { usedAt: expect.any(Date) },
        })
      );
    });

    it("returns nulls without throwing for an unknown email", async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await expect(
        issueResetTokenForEmail("ghost@example.com")
      ).resolves.toEqual({ emailedToken: null, user: null });
      expect(mockTokenCreate).not.toHaveBeenCalled();
    });

    it("returns nulls for an inactive user", async () => {
      mockUserFindUnique.mockResolvedValue({ ...activeUser, isActive: false });

      await expect(
        issueResetTokenForEmail("jane@example.com")
      ).resolves.toEqual({ emailedToken: null, user: null });
      expect(mockTokenCreate).not.toHaveBeenCalled();
    });
  });

  describe("issueSetupTokenForUser", () => {
    it("stores a hashed SETUP token with the 72h TTL and returns the raw token", async () => {
      mockUserFindUnique.mockResolvedValue({ id: "u1" });

      const raw = await issueSetupTokenForUser("u1");

      const createArg = mockTokenCreate.mock.calls[0][0];
      expect(createArg.data.tokenHash).toBe(hashToken(raw));
      expect(createArg.data.purpose).toBe("SETUP");
      const ttlMs = createArg.data.expiresAt.getTime() - Date.now();
      expect(ttlMs).toBeGreaterThan((SETUP_TOKEN_TTL_HOURS - 1) * 3_600_000);
      expect(ttlMs).toBeLessThanOrEqual(SETUP_TOKEN_TTL_HOURS * 3_600_000);
    });

    it("throws NotFoundError for an unknown user", async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await expect(issueSetupTokenForUser("ghost")).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe("resolveSetupInvite", () => {
    it("returns the invite projection for a valid SETUP token", async () => {
      mockTokenFindUnique.mockResolvedValue(validToken({ purpose: "SETUP" }));

      await expect(resolveSetupInvite("raw-token")).resolves.toEqual({
        email: "jane@example.com",
        firstName: "Jane",
        role: "STAFF",
      });
      expect(mockTokenFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tokenHash: hashToken("raw-token") },
        })
      );
    });

    it("throws NotFoundError for a RESET-purpose token", async () => {
      mockTokenFindUnique.mockResolvedValue(validToken({ purpose: "RESET" }));

      await expect(resolveSetupInvite("raw-token")).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe("consumeResetToken", () => {
    it("hashes the password, marks the token used, and bumps tokenVersion in a transaction", async () => {
      mockTokenFindUnique.mockResolvedValue(validToken());
      mockTokenUpdateMany.mockResolvedValue({ count: 1 });

      const result = await consumeResetToken({
        rawToken: "raw-token",
        newPassword: "NewStr0ng!Pass",
      });

      expect(result).toEqual({ userId: "u1" });
      expect(mockTransaction).toHaveBeenCalledTimes(1);

      // Atomic single-use guard: conditional updateMany on the token row.
      const claimCall = mockTokenUpdateMany.mock.calls.find(
        ([arg]) => (arg as { where?: { id?: string } }).where?.id === "t1"
      );
      expect(claimCall).toBeDefined();
      expect(claimCall![0]).toEqual(
        expect.objectContaining({
          where: { id: "t1", usedAt: null },
          data: { usedAt: expect.any(Date) },
        })
      );

      const userUpdateArg = mockUserUpdate.mock.calls[0][0];
      expect(userUpdateArg.where).toEqual({ id: "u1" });
      expect(userUpdateArg.data.tokenVersion).toEqual({ increment: 1 });
      expect(userUpdateArg.data.isActive).toBeUndefined();
      expect(userUpdateArg.data.password).not.toBe("NewStr0ng!Pass");
      await expect(
        bcrypt.compare("NewStr0ng!Pass", userUpdateArg.data.password)
      ).resolves.toBe(true);

      expect(mockAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "u1",
            action: "STAFF_PASSWORD_RESET",
            entityType: "STAFF",
          }),
        })
      );
    });

    it("throws NotFoundError and skips the password write when a concurrent request already consumed the token", async () => {
      mockTokenFindUnique.mockResolvedValue(validToken());
      // Race: read saw usedAt: null, but by the time the transaction runs
      // another request already claimed the row → count: 0.
      mockTokenUpdateMany.mockResolvedValue({ count: 0 });

      await expect(
        consumeResetToken({
          rawToken: "raw-token",
          newPassword: "NewStr0ng!Pass",
        })
      ).rejects.toThrow(NotFoundError);

      expect(mockUserUpdate).not.toHaveBeenCalled();
      expect(mockAuditLogCreate).not.toHaveBeenCalled();
    });

    it("throws NotFoundError for a missing token", async () => {
      mockTokenFindUnique.mockResolvedValue(null);

      await expect(
        consumeResetToken({ rawToken: "nope", newPassword: "NewStr0ng!Pass" })
      ).rejects.toThrow(NotFoundError);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it("throws NotFoundError for an expired token", async () => {
      mockTokenFindUnique.mockResolvedValue(
        validToken({ expiresAt: new Date(Date.now() - 1_000) })
      );

      await expect(
        consumeResetToken({
          rawToken: "raw-token",
          newPassword: "NewStr0ng!Pass",
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for an already-used token", async () => {
      mockTokenFindUnique.mockResolvedValue(
        validToken({ usedAt: new Date() })
      );

      await expect(
        consumeResetToken({
          rawToken: "raw-token",
          newPassword: "NewStr0ng!Pass",
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("consumeSetupToken", () => {
    it("additionally activates the account and audits as SETUP", async () => {
      mockTokenFindUnique.mockResolvedValue(validToken({ purpose: "SETUP" }));
      mockTokenUpdateMany.mockResolvedValue({ count: 1 });

      await consumeSetupToken({
        rawToken: "raw-token",
        newPassword: "NewStr0ng!Pass",
      });

      const userUpdateArg = mockUserUpdate.mock.calls[0][0];
      expect(userUpdateArg.data.isActive).toBe(true);
      expect(mockAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "STAFF_PASSWORD_SETUP" }),
        })
      );
    });
  });

  describe("requestPasswordReset", () => {
    const activeUserRow = {
      id: "u1",
      email: "jane@example.com",
      firstName: "Jane",
      isActive: true,
    };
    const deferSend = vi.fn();

    beforeEach(() => {
      deferSend.mockReset();
      mockGetForgotPasswordRateLimiter.mockReturnValue({
        limit: (...args: unknown[]) => mockRateLimit(...args),
      });
      mockRateLimit.mockResolvedValue({ success: true });
    });

    it("checks both ip and email rate-limit keys and defers the send for a known email", async () => {
      mockUserFindUnique.mockResolvedValue(activeUserRow);

      await requestPasswordReset(
        { email: "jane@example.com", ip: "203.0.113.7" },
        deferSend,
      );

      const keys = mockRateLimit.mock.calls.map((c) => c[0] as string);
      expect(keys).toContain("ip:203.0.113.7");
      expect(keys).toContain("email:jane@example.com");
      expect(mockTokenCreate).toHaveBeenCalledTimes(1);
      expect(deferSend).toHaveBeenCalledTimes(1);
      expect(typeof deferSend.mock.calls[0][0]).toBe("function");
    });

    it("does not defer a send for an unknown email (enumeration protection)", async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await requestPasswordReset(
        { email: "ghost@example.com", ip: "203.0.113.7" },
        deferSend,
      );

      expect(mockTokenCreate).not.toHaveBeenCalled();
      expect(deferSend).not.toHaveBeenCalled();
    });

    it("does not defer a send for an inactive user", async () => {
      mockUserFindUnique.mockResolvedValue({
        ...activeUserRow,
        isActive: false,
      });

      await requestPasswordReset(
        { email: "jane@example.com", ip: "203.0.113.7" },
        deferSend,
      );

      expect(deferSend).not.toHaveBeenCalled();
    });

    it("throws RateLimitError when the ip: bucket is exhausted, before touching the DB", async () => {
      mockRateLimit
        .mockResolvedValueOnce({ success: false })
        .mockResolvedValueOnce({ success: true });

      await expect(
        requestPasswordReset(
          { email: "jane@example.com", ip: "203.0.113.7" },
          deferSend,
        ),
      ).rejects.toThrow(RateLimitError);
      expect(mockUserFindUnique).not.toHaveBeenCalled();
      expect(deferSend).not.toHaveBeenCalled();
    });

    it("throws RateLimitError when the email: bucket is exhausted", async () => {
      mockRateLimit
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false });

      await expect(
        requestPasswordReset(
          { email: "jane@example.com", ip: "203.0.113.7" },
          deferSend,
        ),
      ).rejects.toThrow(RateLimitError);
      expect(deferSend).not.toHaveBeenCalled();
    });

    it("skips the rate-limit check when the limiter is unconfigured", async () => {
      mockGetForgotPasswordRateLimiter.mockReturnValue(null);
      mockUserFindUnique.mockResolvedValue(activeUserRow);

      await requestPasswordReset(
        { email: "jane@example.com", ip: "203.0.113.7" },
        deferSend,
      );

      expect(mockRateLimit).not.toHaveBeenCalled();
      expect(deferSend).toHaveBeenCalledTimes(1);
    });

    it("swallows mailer failure inside the deferred closure and logs it", async () => {
      mockUserFindUnique.mockResolvedValue(activeUserRow);
      mockSend.mockRejectedValue(new Error("smtp down"));

      await requestPasswordReset(
        { email: "jane@example.com", ip: "203.0.113.7" },
        deferSend,
      );

      const deferredTask = deferSend.mock.calls[0][0] as () => Promise<void>;
      // The closure must not re-throw — that's how enumeration protection
      // survives a mailer outage.
      await expect(deferredTask()).resolves.toBeUndefined();

      expect(mockLoggerError).toHaveBeenCalledWith(
        "Failed to send password-reset email",
        expect.any(Error),
        { userId: "u1" },
      );
    });

    it("sends via the transport with the composed template when the closure runs", async () => {
      mockUserFindUnique.mockResolvedValue(activeUserRow);
      mockSend.mockResolvedValue(undefined);

      await requestPasswordReset(
        { email: "jane@example.com", ip: "203.0.113.7" },
        deferSend,
      );

      const deferredTask = deferSend.mock.calls[0][0] as () => Promise<void>;
      await deferredTask();

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ to: "jane@example.com" }),
      );
    });
  });
});
