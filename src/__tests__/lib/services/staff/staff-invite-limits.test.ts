import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setupMocks,
  resetMocks,
  mockInviteLimit,
  mockInviteGlobalLimit,
  mockGetStaffInviteRateLimiter,
  mockGetStaffInviteGlobalRateLimiter,
} from "./test-utils";
import { ValidationError, RateLimitError } from "@/lib/errors";

// Setup mocks before importing the module under test
setupMocks();

import {
  assertAllowedRecipient,
  spendInviteLimit,
} from "@/lib/services/staff/staff-invite-limits";

const MESSAGE = "Too many of something. Try again later.";

describe("staff-invite-limits", () => {
  const originalAllowlist = process.env.INVITE_DOMAIN_ALLOWLIST;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  afterEach(() => {
    if (originalAllowlist === undefined) {
      delete process.env.INVITE_DOMAIN_ALLOWLIST;
    } else {
      process.env.INVITE_DOMAIN_ALLOWLIST = originalAllowlist;
    }
  });

  describe("spendInviteLimit", () => {
    it("resolves when both buckets allow: per-GM keyed by the GM id, global keyed 'global'", async () => {
      await expect(spendInviteLimit("gm-1", MESSAGE)).resolves.toBeUndefined();

      expect(mockInviteLimit).toHaveBeenCalledTimes(1);
      expect(mockInviteLimit).toHaveBeenCalledWith("gm-1");
      expect(mockInviteGlobalLimit).toHaveBeenCalledTimes(1);
      expect(mockInviteGlobalLimit).toHaveBeenCalledWith("global");
    });

    it("spends the per-GM bucket before the global bucket", async () => {
      await spendInviteLimit("gm-1", MESSAGE);

      expect(mockInviteLimit.mock.invocationCallOrder[0]).toBeLessThan(
        mockInviteGlobalLimit.mock.invocationCallOrder[0]
      );
    });

    it("per-GM refusal throws RateLimitError with the given message and never calls the global limiter", async () => {
      mockInviteLimit.mockResolvedValue({ success: false });

      const result = spendInviteLimit("gm-1", MESSAGE);

      await expect(result).rejects.toThrow(RateLimitError);
      await expect(result).rejects.toMatchObject({ message: MESSAGE });
      expect(mockInviteLimit).toHaveBeenCalledWith("gm-1");
      expect(mockInviteGlobalLimit).not.toHaveBeenCalled();
    });

    it("global refusal throws RateLimitError with the given message, after the per-GM bucket was spent", async () => {
      mockInviteGlobalLimit.mockResolvedValue({ success: false });

      const result = spendInviteLimit("gm-1", MESSAGE);

      await expect(result).rejects.toThrow(RateLimitError);
      await expect(result).rejects.toMatchObject({ message: MESSAGE });
      expect(mockInviteLimit).toHaveBeenCalledWith("gm-1");
      expect(mockInviteGlobalLimit).toHaveBeenCalledWith("global");
    });

    it("skips an unconfigured per-GM limiter but still spends the global one", async () => {
      mockGetStaffInviteRateLimiter.mockReturnValue(null);

      await expect(spendInviteLimit("gm-1", MESSAGE)).resolves.toBeUndefined();

      expect(mockInviteLimit).not.toHaveBeenCalled();
      expect(mockInviteGlobalLimit).toHaveBeenCalledWith("global");
    });

    it("skips an unconfigured global limiter but still spends the per-GM one", async () => {
      mockGetStaffInviteGlobalRateLimiter.mockReturnValue(null);

      await expect(spendInviteLimit("gm-1", MESSAGE)).resolves.toBeUndefined();

      expect(mockInviteLimit).toHaveBeenCalledWith("gm-1");
      expect(mockInviteGlobalLimit).not.toHaveBeenCalled();
    });

    it("resolves with both limiters unconfigured", async () => {
      mockGetStaffInviteRateLimiter.mockReturnValue(null);
      mockGetStaffInviteGlobalRateLimiter.mockReturnValue(null);

      await expect(spendInviteLimit("gm-1", MESSAGE)).resolves.toBeUndefined();
    });
  });

  describe("assertAllowedRecipient", () => {
    it("allows a domain on the allowlist", () => {
      process.env.INVITE_DOMAIN_ALLOWLIST = "hotel.test";

      expect(() => assertAllowedRecipient("jane@hotel.test")).not.toThrow();
    });

    it("refuses a domain outside the allowlist with the deployment message", () => {
      process.env.INVITE_DOMAIN_ALLOWLIST = "hotel.test";

      expect(() => assertAllowedRecipient("x@evil.example")).toThrow(
        ValidationError
      );
      expect(() => assertAllowedRecipient("x@evil.example")).toThrow(
        "Recipient email domain is not allowed on this deployment."
      );
    });

    it("allows any domain when the allowlist is unset", () => {
      delete process.env.INVITE_DOMAIN_ALLOWLIST;

      expect(() =>
        assertAllowedRecipient("anyone@anywhere.example")
      ).not.toThrow();
    });
  });
});
