import { z } from "zod";

const dateStringSchema = z
  .string()
  .refine((val) => !isNaN(Date.parse(val)), "Please enter a valid date");

// Query params for GET /api/calendar — all optional to keep the "give me
// everything" default. `roomId` may be the literal "all" (service treats that
// as "no filter") or a specific room id.
export const calendarQuerySchema = z.object({
  start: dateStringSchema.optional(),
  end: dateStringSchema.optional(),
  roomId: z.string().min(1).optional(),
});

export type CalendarQueryInput = z.infer<typeof calendarQuerySchema>;
