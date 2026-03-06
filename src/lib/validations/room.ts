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

// Inferred types from schemas
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
