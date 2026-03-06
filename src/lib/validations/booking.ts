import { z } from "zod";

// Booking status enum for validation
const bookingStatusEnum = z.enum([
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
]);

// Phone number validation (Australian format or international)
const phoneSchema = z
  .string()
  .regex(
    /^(\+?61|0)?[2-478](\d{8}|\d{4}\s?\d{4})$|^\+?[1-9]\d{6,14}$/,
    "Please enter a valid phone number"
  )
  .optional()
  .or(z.literal(""));

// Date string validation (ISO format)
const dateStringSchema = z
  .string()
  .min(1, "Date is required")
  .refine(
    (val) => !isNaN(Date.parse(val)),
    "Please enter a valid date"
  );

// Optional date string
const optionalDateStringSchema = z
  .string()
  .refine(
    (val) => val === "" || !isNaN(Date.parse(val)),
    "Please enter a valid date"
  )
  .optional()
  .or(z.literal(""));

// Time string validation (HH:mm format)
const timeStringSchema = z
  .string()
  .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Please enter a valid time (HH:mm)")
  .optional()
  .or(z.literal(""));

// Schema for creating a new booking
export const createBookingSchema = z
  .object({
    roomId: z.string().min(1, "Room is required"),
    // Guest Details
    guestName: z.string().min(1, "Guest name is required").max(100, "Name is too long"),
    guestDateOfBirth: optionalDateStringSchema,
    guestAddress: z.string().max(500, "Address is too long").optional().or(z.literal("")),
    guestPhone: phoneSchema,
    guestEmail: z.string().email("Valid email is required"),
    vehicleRego: z
      .string()
      .max(20, "Vehicle registration is too long")
      .optional()
      .or(z.literal("")),
    additionalGuests: z.string().max(1000, "Additional guests text is too long").optional(),
    // Stay Details
    checkIn: dateStringSchema,
    checkInTime: timeStringSchema,
    checkOut: dateStringSchema,
    checkOutTime: timeStringSchema,
    bondDeposit: z.number().min(0, "Bond deposit cannot be negative").optional(),
    notes: z.string().max(2000, "Notes are too long").optional(),
  })
  .refine(
    (data) => {
      const checkInDate = new Date(data.checkIn);
      const checkOutDate = new Date(data.checkOut);
      return checkOutDate > checkInDate;
    },
    {
      message: "Check-out date must be after check-in date",
      path: ["checkOut"],
    }
  );

// Schema for updating a booking (all fields optional)
export const updateBookingSchema = z
  .object({
    roomId: z.string().min(1, "Room is required").optional(),
    // Guest Details
    guestName: z.string().min(1, "Guest name is required").max(100, "Name is too long").optional(),
    guestDateOfBirth: optionalDateStringSchema.nullable(),
    guestAddress: z.string().max(500, "Address is too long").optional().nullable(),
    guestPhone: phoneSchema.nullable(),
    guestEmail: z.string().email("Valid email is required").optional(),
    vehicleRego: z.string().max(20, "Vehicle registration is too long").optional().nullable(),
    additionalGuests: z.string().max(1000, "Additional guests text is too long").optional().nullable(),
    // Stay Details
    checkIn: dateStringSchema.optional(),
    checkInTime: timeStringSchema.nullable(),
    checkOut: dateStringSchema.optional(),
    checkOutTime: timeStringSchema.nullable(),
    bondDeposit: z.number().min(0, "Bond deposit cannot be negative").optional().nullable(),
    status: bookingStatusEnum.optional(),
    notes: z.string().max(2000, "Notes are too long").optional().nullable(),
  })
  .refine(
    (data) => {
      // Only validate if both dates are provided
      if (data.checkIn && data.checkOut) {
        const checkInDate = new Date(data.checkIn);
        const checkOutDate = new Date(data.checkOut);
        return checkOutDate > checkInDate;
      }
      return true;
    },
    {
      message: "Check-out date must be after check-in date",
      path: ["checkOut"],
    }
  );

// Schema for status updates only (used for check-in/check-out operations)
export const updateBookingStatusSchema = z.object({
  status: bookingStatusEnum,
});

// Inferred types from schemas
export type CreateBookingSchemaInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingSchemaInput = z.infer<typeof updateBookingSchema>;
export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;
