import { z } from "zod";

const dateStringSchema = z
  .string()
  .refine((val) => !isNaN(Date.parse(val)), "Please enter a valid date");

// Query params for GET /api/reports. Only `type=rooms` is a live path
// after the dead-slice sweep (#189). `type` still defaults to
// `"rooms"` so callers that omit it keep working; `startDate`/`endDate`
// window the room-performance data.
export const reportsQuerySchema = z.object({
  type: z.literal("rooms").default("rooms"),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
});


