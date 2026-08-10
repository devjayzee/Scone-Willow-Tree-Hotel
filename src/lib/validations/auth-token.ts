import { z } from "zod";
import { strongPasswordSchema } from "@/lib/validations/password";
import { emailSchema } from "@/lib/validations/email";

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: strongPasswordSchema,
});

export const setupPasswordSchema = z.object({
  token: z.string().min(1, "Setup token is required"),
  password: strongPasswordSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type SetupPasswordInput = z.infer<typeof setupPasswordSchema>;
