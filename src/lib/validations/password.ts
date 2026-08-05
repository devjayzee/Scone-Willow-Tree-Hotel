import { z } from "zod";

/**
 * Password strength requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REGEX = {
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  number: /[0-9]/,
  special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
};

/**
 * Validates password strength and returns specific error messages.
 */
function validatePasswordStrength(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }

  if (!PASSWORD_REGEX.uppercase.test(password)) {
    return "Password must contain at least one uppercase letter";
  }

  if (!PASSWORD_REGEX.lowercase.test(password)) {
    return "Password must contain at least one lowercase letter";
  }

  if (!PASSWORD_REGEX.number.test(password)) {
    return "Password must contain at least one number";
  }

  if (!PASSWORD_REGEX.special.test(password)) {
    return "Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:'\",.<>?/)";
  }

  return null;
}

/**
 * Zod schema for strong password validation.
 * Use this for password fields that require strength validation.
 */
export const strongPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .refine((password) => PASSWORD_REGEX.uppercase.test(password), {
    message: "Password must contain at least one uppercase letter",
  })
  .refine((password) => PASSWORD_REGEX.lowercase.test(password), {
    message: "Password must contain at least one lowercase letter",
  })
  .refine((password) => PASSWORD_REGEX.number.test(password), {
    message: "Password must contain at least one number",
  })
  .refine((password) => PASSWORD_REGEX.special.test(password), {
    message: "Password must contain at least one special character",
  });

/**
 * Optional strong password schema for update operations.
 * When provided, the password must meet strength requirements.
 *
 * Derived from strongPasswordSchema via `.optional()` so a rule change
 * in one propagates automatically — zod preserves upstream refinements.
 */
export const optionalStrongPasswordSchema = strongPasswordSchema.optional();

/**
 * Get password requirements as a list for display in UI.
 */
export function getPasswordRequirements(): string[] {
  return [
    `At least ${PASSWORD_MIN_LENGTH} characters`,
    "At least one uppercase letter (A-Z)",
    "At least one lowercase letter (a-z)",
    "At least one number (0-9)",
    "At least one special character (!@#$%^&*)",
  ];
}

/**
 * Check password strength and return validation results for UI feedback.
 */
export function checkPasswordStrength(password: string): {
  isValid: boolean;
  checks: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  };
  strength: "weak" | "fair" | "good" | "strong";
} {
  const checks = {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    hasUppercase: PASSWORD_REGEX.uppercase.test(password),
    hasLowercase: PASSWORD_REGEX.lowercase.test(password),
    hasNumber: PASSWORD_REGEX.number.test(password),
    hasSpecial: PASSWORD_REGEX.special.test(password),
  };

  const passedChecks = Object.values(checks).filter(Boolean).length;
  const isValid = passedChecks === 5;

  let strength: "weak" | "fair" | "good" | "strong";
  if (passedChecks <= 2) {
    strength = "weak";
  } else if (passedChecks === 3) {
    strength = "fair";
  } else if (passedChecks === 4) {
    strength = "good";
  } else {
    strength = "strong";
  }

  return { isValid, checks, strength };
}

/**
 * Generate a strong password that meets all requirements:
 * - At least 12 characters
 * - Uppercase, lowercase, numbers, special characters
 */
export function generatePassword(): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "!@#$%^&*";
  const all = uppercase + lowercase + numbers + special;

  // Ensure at least one of each required type
  let password = "";
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill remaining characters (total 12 characters)
  for (let i = 0; i < 8; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

export { validatePasswordStrength, PASSWORD_MIN_LENGTH };
