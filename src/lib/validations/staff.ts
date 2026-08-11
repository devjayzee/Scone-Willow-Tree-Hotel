import { z } from "zod";
import { emailSchema } from "./email";

// Role enum for validation
const roleEnum = z.enum(["GENERAL_MANAGER", "MANAGER", "STAFF"]);

// Schema for creating a new staff member (#144). No password — new staff
// are invited via email and set their own on the /setup-password page.
// 100-char cap on names (#184) bounds render + storage cost; genuine
// full names sit well under.
export const createStaffSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(100, "First name must be 100 characters or fewer"),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(100, "Last name must be 100 characters or fewer"),
  email: emailSchema,
  role: roleEnum.default("STAFF"),
});

// Schema for updating a staff member (all fields optional).
// Password rotation is deliberately NOT accepted here (#188) — GMs
// cannot set another user's password directly; rotation goes through
// the /reset-password flow.
export const updateStaffSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(100, "First name must be 100 characters or fewer")
    .optional(),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(100, "Last name must be 100 characters or fewer")
    .optional(),
  email: emailSchema.optional(),
  role: roleEnum.optional(),
  isActive: z.boolean().optional(),
});

// Inferred types from schemas
export type CreateStaffSchemaInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffSchemaInput = z.infer<typeof updateStaffSchema>;
