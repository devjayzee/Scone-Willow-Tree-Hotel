import { describe, it, expect } from "vitest";
import {
  createStaffSchema,
  updateStaffSchema,
} from "@/lib/validations/staff";

describe("Staff Validation", () => {
  // ============================================================
  // createStaffSchema
  // ============================================================
  describe("createStaffSchema", () => {
    const validStaff = {
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
      password: "SecureP@ss123",
    };

    it("should accept valid staff with required fields", () => {
      const result = createStaffSchema.safeParse(validStaff);
      expect(result.success).toBe(true);
    });

    it("should accept valid staff with role", () => {
      const result = createStaffSchema.safeParse({
        ...validStaff,
        role: "MANAGER",
      });
      expect(result.success).toBe(true);
    });

    it("should use default role of STAFF", () => {
      const result = createStaffSchema.safeParse(validStaff);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe("STAFF");
      }
    });

    // Required fields
    it("should reject staff without firstName", () => {
      const { firstName: _firstName, ...noFirstName } = validStaff;
      const result = createStaffSchema.safeParse(noFirstName);
      expect(result.success).toBe(false);
    });

    it("should reject staff with empty firstName", () => {
      const result = createStaffSchema.safeParse({
        ...validStaff,
        firstName: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject staff without lastName", () => {
      const { lastName: _lastName, ...noLastName } = validStaff;
      const result = createStaffSchema.safeParse(noLastName);
      expect(result.success).toBe(false);
    });

    it("should reject staff with empty lastName", () => {
      const result = createStaffSchema.safeParse({
        ...validStaff,
        lastName: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject staff without email", () => {
      const { email: _email, ...noEmail } = validStaff;
      const result = createStaffSchema.safeParse(noEmail);
      expect(result.success).toBe(false);
    });

    // password removed from createStaffSchema — new staff receive an
    // email invite and set their own password on /setup-password.
    it("ignores an incoming password field (invite flow)", () => {
      const result = createStaffSchema.safeParse({
        ...validStaff,
        password: "anything",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as { password?: unknown }).password).toBeUndefined();
      }
    });

    // Email validation
    it("should accept valid email formats", () => {
      const validEmails = [
        "user@example.com",
        "user.name@example.com",
        "user+tag@example.co.uk",
      ];
      validEmails.forEach(email => {
        const result = createStaffSchema.safeParse({ ...validStaff, email });
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid email formats", () => {
      const invalidEmails = [
        "not-an-email",
        "missing@domain",
        "@nodomain.com",
        "spaces in@email.com",
      ];
      invalidEmails.forEach(email => {
        const result = createStaffSchema.safeParse({ ...validStaff, email });
        expect(result.success).toBe(false);
      });
    });

    it("normalizes email to trimmed lowercase", () => {
      const result = createStaffSchema.safeParse({
        ...validStaff,
        email: "  Jane@Example.COM \n",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("jane@example.com");
      }
    });

    // Role validation
    it("should accept valid roles", () => {
      const validRoles = ["GENERAL_MANAGER", "MANAGER", "STAFF"];
      validRoles.forEach(role => {
        const result = createStaffSchema.safeParse({ ...validStaff, role });
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid role", () => {
      const result = createStaffSchema.safeParse({
        ...validStaff,
        role: "ADMIN",
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // updateStaffSchema
  // ============================================================
  describe("updateStaffSchema", () => {
    it("should accept empty update (all optional)", () => {
      const result = updateStaffSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should accept partial update with firstName", () => {
      const result = updateStaffSchema.safeParse({
        firstName: "Jane",
      });
      expect(result.success).toBe(true);
    });

    it("should accept partial update with lastName", () => {
      const result = updateStaffSchema.safeParse({
        lastName: "Smith",
      });
      expect(result.success).toBe(true);
    });

    it("should accept partial update with email", () => {
      const result = updateStaffSchema.safeParse({
        email: "newemail@example.com",
      });
      expect(result.success).toBe(true);
    });

    it("strips password from update payloads — rotation goes through /reset-password", () => {
      const result = updateStaffSchema.safeParse({
        firstName: "Jane",
        password: "AnyValidP@ss123",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as { password?: unknown }).password).toBeUndefined();
      }
    });

    it("should accept partial update with role", () => {
      const result = updateStaffSchema.safeParse({
        role: "MANAGER",
      });
      expect(result.success).toBe(true);
    });

    it("should accept isActive update", () => {
      const result = updateStaffSchema.safeParse({
        isActive: false,
      });
      expect(result.success).toBe(true);
    });

    it("should accept full update", () => {
      const result = updateStaffSchema.safeParse({
        firstName: "Jane",
        lastName: "Smith",
        email: "jane.smith@example.com",
        role: "MANAGER",
        isActive: true,
      });
      expect(result.success).toBe(true);
    });

    // Validation still applies when fields are provided
    it("should reject empty firstName when provided", () => {
      const result = updateStaffSchema.safeParse({
        firstName: "",
      });
      expect(result.success).toBe(false);
    });

    it("normalizes email to trimmed lowercase when provided", () => {
      const result = updateStaffSchema.safeParse({
        email: "  Jane@Example.COM \n",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("jane@example.com");
      }
    });

    it("should reject invalid email when provided", () => {
      const result = updateStaffSchema.safeParse({
        email: "not-an-email",
      });
      expect(result.success).toBe(false);
    });

    it("ignores an incoming password field entirely", () => {
      // password is not in the schema; zod silently drops it on non-strict
      // parse. The strong-password rule stays enforced by the reset flow.
      const result = updateStaffSchema.safeParse({
        password: "weak",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as { password?: unknown }).password).toBeUndefined();
      }
    });

    it("should reject invalid role when provided", () => {
      const result = updateStaffSchema.safeParse({
        role: "SUPERUSER",
      });
      expect(result.success).toBe(false);
    });

    it("should allow updating multiple fields at once", () => {
      const result = updateStaffSchema.safeParse({
        firstName: "Updated",
        role: "GENERAL_MANAGER",
        isActive: true,
      });
      expect(result.success).toBe(true);
    });
  });
});
