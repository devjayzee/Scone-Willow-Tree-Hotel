import { describe, it, expect } from "vitest";
import {
  strongPasswordSchema,
  optionalStrongPasswordSchema,
  checkPasswordStrength,
  generatePassword,
  getPasswordRequirements,
  validatePasswordStrength,
  PASSWORD_MIN_LENGTH,
} from "@/lib/validations/password";

describe("Password Validation", () => {
  // ============================================================
  // strongPasswordSchema
  // ============================================================
  describe("strongPasswordSchema", () => {
    it("should accept a valid strong password", () => {
      const validPassword = "SecureP@ss123";
      const result = strongPasswordSchema.safeParse(validPassword);
      expect(result.success).toBe(true);
    });

    it("should reject password shorter than minimum length", () => {
      const shortPassword = "Sh@rt1";
      const result = strongPasswordSchema.safeParse(shortPassword);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("at least 8 characters");
      }
    });

    it("should reject password without uppercase letter", () => {
      const noUppercase = "lowercase@123";
      const result = strongPasswordSchema.safeParse(noUppercase);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(i => i.message.includes("uppercase"))).toBe(true);
      }
    });

    it("should reject password without lowercase letter", () => {
      const noLowercase = "UPPERCASE@123";
      const result = strongPasswordSchema.safeParse(noLowercase);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(i => i.message.includes("lowercase"))).toBe(true);
      }
    });

    it("should reject password without number", () => {
      const noNumber = "NoNumbers@Here";
      const result = strongPasswordSchema.safeParse(noNumber);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(i => i.message.includes("number"))).toBe(true);
      }
    });

    it("should reject password without special character", () => {
      const noSpecial = "NoSpecial123";
      const result = strongPasswordSchema.safeParse(noSpecial);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(i => i.message.includes("special"))).toBe(true);
      }
    });

    it("should accept password with various special characters", () => {
      const specialChars = ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")"];
      specialChars.forEach(char => {
        const password = `Password${char}123`;
        const result = strongPasswordSchema.safeParse(password);
        expect(result.success).toBe(true);
      });
    });
  });

  // ============================================================
  // optionalStrongPasswordSchema
  // ============================================================
  describe("optionalStrongPasswordSchema", () => {
    it("should accept undefined", () => {
      const result = optionalStrongPasswordSchema.safeParse(undefined);
      expect(result.success).toBe(true);
    });

    it("should accept valid strong password when provided", () => {
      const result = optionalStrongPasswordSchema.safeParse("SecureP@ss123");
      expect(result.success).toBe(true);
    });

    it("should reject weak password when provided", () => {
      const result = optionalStrongPasswordSchema.safeParse("weak");
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // checkPasswordStrength
  // ============================================================
  describe("checkPasswordStrength", () => {
    it("should return strong for valid password", () => {
      const result = checkPasswordStrength("SecureP@ss123");
      expect(result.isValid).toBe(true);
      expect(result.strength).toBe("strong");
      expect(result.checks.minLength).toBe(true);
      expect(result.checks.hasUppercase).toBe(true);
      expect(result.checks.hasLowercase).toBe(true);
      expect(result.checks.hasNumber).toBe(true);
      expect(result.checks.hasSpecial).toBe(true);
    });

    it("should return weak for very weak password", () => {
      const result = checkPasswordStrength("ab");
      expect(result.isValid).toBe(false);
      expect(result.strength).toBe("weak");
    });

    it("should return fair for password with 3 criteria met", () => {
      const result = checkPasswordStrength("Password"); // min length, upper, lower
      expect(result.strength).toBe("fair");
    });

    it("should return good for password with 4 criteria met", () => {
      const result = checkPasswordStrength("Password1"); // min length, upper, lower, number
      expect(result.strength).toBe("good");
    });

    it("should correctly identify missing criteria", () => {
      const result = checkPasswordStrength("short");
      expect(result.checks.minLength).toBe(false);
      expect(result.checks.hasUppercase).toBe(false);
      expect(result.checks.hasNumber).toBe(false);
      expect(result.checks.hasSpecial).toBe(false);
      expect(result.checks.hasLowercase).toBe(true);
    });
  });

  // ============================================================
  // generatePassword
  // ============================================================
  describe("generatePassword", () => {
    it("should generate a 12-character password", () => {
      const password = generatePassword();
      expect(password.length).toBe(12);
    });

    it("should generate password that passes validation", () => {
      // Generate multiple passwords to ensure consistency
      for (let i = 0; i < 10; i++) {
        const password = generatePassword();
        const result = strongPasswordSchema.safeParse(password);
        expect(result.success).toBe(true);
      }
    });

    it("should generate different passwords each time", () => {
      const passwords = new Set<string>();
      for (let i = 0; i < 10; i++) {
        passwords.add(generatePassword());
      }
      // Should have generated at least 9 unique passwords
      expect(passwords.size).toBeGreaterThanOrEqual(9);
    });
  });

  // ============================================================
  // getPasswordRequirements
  // ============================================================
  describe("getPasswordRequirements", () => {
    it("should return array of requirements", () => {
      const requirements = getPasswordRequirements();
      expect(Array.isArray(requirements)).toBe(true);
      expect(requirements.length).toBe(5);
    });

    it("should include all requirement types", () => {
      const requirements = getPasswordRequirements();
      expect(requirements.some(r => r.includes("8 characters"))).toBe(true);
      expect(requirements.some(r => r.includes("uppercase"))).toBe(true);
      expect(requirements.some(r => r.includes("lowercase"))).toBe(true);
      expect(requirements.some(r => r.includes("number"))).toBe(true);
      expect(requirements.some(r => r.includes("special"))).toBe(true);
    });
  });

  // ============================================================
  // validatePasswordStrength
  // ============================================================
  describe("validatePasswordStrength", () => {
    it("should return null for valid password", () => {
      const result = validatePasswordStrength("SecureP@ss123");
      expect(result).toBeNull();
    });

    it("should return error message for short password", () => {
      const result = validatePasswordStrength("Short1!");
      expect(result).toContain("8 characters");
    });

    it("should return error message for missing uppercase", () => {
      const result = validatePasswordStrength("lowercase@123");
      expect(result).toContain("uppercase");
    });

    it("should return error message for missing lowercase", () => {
      const result = validatePasswordStrength("UPPERCASE@123");
      expect(result).toContain("lowercase");
    });

    it("should return error message for missing number", () => {
      const result = validatePasswordStrength("NoNumbers@Here");
      expect(result).toContain("number");
    });

    it("should return error message for missing special character", () => {
      const result = validatePasswordStrength("NoSpecial123");
      expect(result).toContain("special");
    });
  });

  // ============================================================
  // PASSWORD_MIN_LENGTH constant
  // ============================================================
  describe("PASSWORD_MIN_LENGTH", () => {
    it("should be 8", () => {
      expect(PASSWORD_MIN_LENGTH).toBe(8);
    });
  });
});
