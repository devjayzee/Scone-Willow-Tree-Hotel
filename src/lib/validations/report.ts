import { z } from "zod";

const dateStringSchema = z
  .string()
  .refine((val) => !isNaN(Date.parse(val)), "Please enter a valid date");

// Query params for GET /api/reports.
// `type` defaults to "dashboard" when the caller omits it (matches the
// pre-schema behaviour). `startDate`/`endDate` are only meaningful for
// `type=rooms`; the flat shape keeps them optional across the board rather
// than using a discriminated union + fallback, which would silently downgrade
// malformed rooms requests to `dashboard`.
export const reportsQuerySchema = z.object({
  type: z
    .enum(["dashboard", "occupancy", "revenue", "bookings", "rooms"])
    .default("dashboard"),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
});

export type ReportsQueryInput = z.infer<typeof reportsQuerySchema>;
