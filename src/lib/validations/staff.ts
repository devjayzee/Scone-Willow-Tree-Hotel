import { z } from "zod";
import {
  strongPasswordSchema,
  optionalStrongPasswordSchema,
} from "./password";

// Role enum for validation
const roleEnum = z.enum(["GENERAL_MANAGER", "STAFF"]);

// Schema for creating a new staff member
export const createStaffSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  password: strongPasswordSchema,
  role: roleEnum.default("STAFF"),
});

// Schema for updating a staff member (all fields optional)
export const updateStaffSchema = z.object({
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
  email: z.string().email("Valid email is required").optional(),
  password: optionalStrongPasswordSchema,
  role: roleEnum.optional(),
  isActive: z.boolean().optional(),
});

// Inferred types from schemas
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
