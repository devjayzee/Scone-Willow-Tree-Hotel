import { vi } from "vitest";
import { BookingStatus } from "@prisma/client";

// Prisma mocks
export const mockBookingCount = vi.fn();
export const mockBookingFindMany = vi.fn();
export const mockRoomCount = vi.fn();
export const mockRoomFindMany = vi.fn();

// Setup mocks — call this at the top of each test file, before importing services.
export function setupMocks() {
  vi.mock("@/lib/prisma", () => ({
    default: {
      booking: {
        count: (...args: unknown[]) => mockBookingCount(...args),
        findMany: (...args: unknown[]) => mockBookingFindMany(...args),
      },
      room: {
        count: (...args: unknown[]) => mockRoomCount(...args),
        findMany: (...args: unknown[]) => mockRoomFindMany(...args),
      },
    },
  }));
}

// Helper to create mock booking data (report-shaped: booking + room summary)
export function createMockBooking(
  overrides: Partial<{
    id: string;
    bookingRef: string;
    guestName: string;
    guestEmail: string;
    checkIn: Date;
    checkOut: Date;
    status: BookingStatus;
    createdAt: Date;
    roomId: string;
    room: { roomNumber: string; pricePerNight: number };
  }> = {}
) {
  return {
    id: overrides.id ?? "booking-1",
    bookingRef: overrides.bookingRef ?? "BK-001",
    guestName: overrides.guestName ?? "John Doe",
    guestEmail: overrides.guestEmail ?? "john@example.com",
    checkIn: overrides.checkIn ?? new Date("2024-03-01"),
    checkOut: overrides.checkOut ?? new Date("2024-03-05"),
    status: overrides.status ?? BookingStatus.CONFIRMED,
    createdAt: overrides.createdAt ?? new Date("2024-02-15"),
    roomId: overrides.roomId ?? "room-1",
    room: overrides.room ?? { roomNumber: "101", pricePerNight: 100 },
  };
}

// Helper to create mock room data (with bookings for occupancy/performance queries)
export function createMockRoom(
  overrides: Partial<{
    id: string;
    roomNumber: string;
    capacity: number;
    pricePerNight: number;
    description: string | null;
    bookings: Array<{
      checkIn: Date;
      checkOut: Date;
      status: BookingStatus;
    }>;
  }> = {}
) {
  return {
    id: overrides.id ?? "room-1",
    roomNumber: overrides.roomNumber ?? "101",
    capacity: overrides.capacity ?? 2,
    pricePerNight: overrides.pricePerNight ?? 100,
    description: overrides.description ?? "Standard room",
    bookings: overrides.bookings ?? [],
  };
}

export function resetMocks() {
  mockBookingCount.mockReset();
  mockBookingFindMany.mockReset();
  mockRoomCount.mockReset();
  mockRoomFindMany.mockReset();
}
