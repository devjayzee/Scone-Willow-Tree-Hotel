import { vi } from "vitest";

// Mock Prisma client functions
export const mockBookingFindMany = vi.fn();
export const mockBookingFindUnique = vi.fn();
export const mockBookingFindFirst = vi.fn();
export const mockBookingCreate = vi.fn();
export const mockBookingUpdate = vi.fn();
export const mockBookingDelete = vi.fn();
export const mockRoomFindUnique = vi.fn();

// Setup mocks - call this before importing any service modules
export function setupMocks() {
  vi.mock("@/lib/prisma", () => ({
    default: {
      booking: {
        findMany: (...args: unknown[]) => mockBookingFindMany(...args),
        findUnique: (...args: unknown[]) => mockBookingFindUnique(...args),
        findFirst: (...args: unknown[]) => mockBookingFindFirst(...args),
        create: (...args: unknown[]) => mockBookingCreate(...args),
        update: (...args: unknown[]) => mockBookingUpdate(...args),
        delete: (...args: unknown[]) => mockBookingDelete(...args),
      },
      room: {
        findUnique: (...args: unknown[]) => mockRoomFindUnique(...args),
      },
    },
  }));

  vi.mock("@/lib/services/audit-service", () => ({
    createAuditLog: vi.fn(),
    AuditAction: {
      BOOKING_CREATED: "BOOKING_CREATED",
      BOOKING_UPDATED: "BOOKING_UPDATED",
      BOOKING_DELETED: "BOOKING_DELETED",
      BOOKING_CHECKED_IN: "BOOKING_CHECKED_IN",
      BOOKING_CHECKED_OUT: "BOOKING_CHECKED_OUT",
      BOOKING_CANCELLED: "BOOKING_CANCELLED",
    },
    EntityType: {
      BOOKING: "BOOKING",
    },
    sanitizeForAudit: (obj: unknown) => obj,
    getChangedFields: vi.fn(() => []),
  }));
}

// Helper to create mock booking data
export function createMockBooking(
  overrides: Partial<{
    id: string;
    bookingRef: string;
    roomId: string;
    guestName: string;
    guestDateOfBirth: Date | null;
    guestAddress: string | null;
    guestEmail: string;
    guestPhone: string | null;
    vehicleRego: string | null;
    additionalGuests: string | null;
    checkIn: Date;
    checkInTime: string | null;
    checkOut: Date;
    checkOutTime: string | null;
    bondDeposit: number | null;
    ratePerNight: number;
    status: string;
    isPaid: boolean;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    room: { id: string; roomNumber: string; pricePerNight: number };
    createdBy: { id: string; firstName: string; lastName: string } | null;
  }> = {}
) {
  return {
    id: overrides.id ?? "booking-1",
    bookingRef: overrides.bookingRef ?? "BK-20240301-001",
    roomId: overrides.roomId ?? "room-1",
    guestName: overrides.guestName ?? "John Doe",
    guestDateOfBirth: overrides.guestDateOfBirth ?? null,
    guestAddress: overrides.guestAddress ?? "123 Main St",
    guestEmail: overrides.guestEmail ?? "john@example.com",
    guestPhone: overrides.guestPhone ?? "0400123456",
    vehicleRego: overrides.vehicleRego ?? null,
    additionalGuests: overrides.additionalGuests ?? null,
    checkIn: overrides.checkIn ?? new Date("2024-03-10"),
    checkInTime: overrides.checkInTime ?? "14:00",
    checkOut: overrides.checkOut ?? new Date("2024-03-15"),
    checkOutTime: overrides.checkOutTime ?? "10:00",
    bondDeposit: overrides.bondDeposit ?? null,
    ratePerNight: overrides.ratePerNight ?? 100,
    status: overrides.status ?? "CONFIRMED",
    isPaid: overrides.isPaid ?? false,
    notes: overrides.notes ?? null,
    createdAt: overrides.createdAt ?? new Date("2024-01-01"),
    updatedAt: overrides.updatedAt ?? new Date("2024-01-01"),
    room: overrides.room ?? { id: "room-1", roomNumber: "101", pricePerNight: 100 },
    createdBy: overrides.createdBy ?? { id: "user-1", firstName: "Admin", lastName: "User" },
  };
}

// Reset all mocks
export function resetMocks() {
  mockBookingFindMany.mockReset();
  mockBookingFindUnique.mockReset();
  mockBookingFindFirst.mockReset();
  mockBookingCreate.mockReset();
  mockBookingUpdate.mockReset();
  mockBookingDelete.mockReset();
  mockRoomFindUnique.mockReset();
}
