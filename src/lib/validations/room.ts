import { z } from "zod";

// Schema for creating a new room
export const createRoomSchema = z.object({
  roomNumber: z.string().min(1, "Room number is required"),
  capacity: z.number().min(1).max(10).default(1),
  pricePerNight: z.number().min(0),
  description: z.string().optional(),
});

// Schema for updating a room (all fields optional)
export const updateRoomSchema = z.object({
  roomNumber: z.string().min(1, "Room number is required").optional(),
  capacity: z.number().min(1).max(10).optional(),
  pricePerNight: z.number().min(0).optional(),
  description: z.string().optional(),
});

// Query params for GET /api/rooms/available — accepts YYYY-MM-DD or full ISO.
const dateStringSchema = z
  .string()
  .refine((val) => !isNaN(Date.parse(val)), "Please enter a valid date");

export const availableRoomsQuerySchema = z
  .object({
    checkIn: dateStringSchema,
    checkOut: dateStringSchema,
  })
  .refine((d) => new Date(d.checkOut) > new Date(d.checkIn), {
    message: "checkOut must be after checkIn",
    path: ["checkOut"],
  });

// Inferred types from schemas
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type AvailableRoomsQueryInput = z.infer<typeof availableRoomsQuerySchema>;
