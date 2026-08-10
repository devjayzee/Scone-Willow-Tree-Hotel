import { describe, it, expect } from "vitest";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  setupPasswordSchema,
} from "@/lib/validations/auth-token";

const VALID_PASSWORD = "StrongPass1!";

describe("auth-token schemas", () => {
  describe("forgotPasswordSchema", () => {
    it("accepts a valid email", () => {
      const result = forgotPasswordSchema.safeParse({
        email: "user@example.com",
      });
      expect(result.success).toBe(true);
    });

    it("rejects a malformed email (delegates to emailSchema)", () => {
      const result = forgotPasswordSchema.safeParse({ email: "not-an-email" });
      expect(result.success).toBe(false);
    });
  });

  describe("resetPasswordSchema", () => {
    it("accepts a valid token + strong password", () => {
      const result = resetPasswordSchema.safeParse({
        token: "raw-token-abc",
        password: VALID_PASSWORD,
      });
      expect(result.success).toBe(true);
    });

    it("rejects an empty token", () => {
      const result = resetPasswordSchema.safeParse({
        token: "",
        password: VALID_PASSWORD,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Reset token is required");
      }
    });

    it("rejects a weak password (delegates to strongPasswordSchema)", () => {
      const result = resetPasswordSchema.safeParse({
        token: "raw-token-abc",
        password: "weak",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("setupPasswordSchema", () => {
    it("accepts a valid token + strong password", () => {
      const result = setupPasswordSchema.safeParse({
        token: "invite-token-xyz",
        password: VALID_PASSWORD,
      });
      expect(result.success).toBe(true);
    });

    it("rejects an empty token", () => {
      const result = setupPasswordSchema.safeParse({
        token: "",
        password: VALID_PASSWORD,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Setup token is required");
      }
    });
  });
});
