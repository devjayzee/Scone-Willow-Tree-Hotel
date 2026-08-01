/**
 * Pure derivations for use-booking-form. Kept in a sibling file so the main
 * hook stays under the 300 LOC threshold. No React imports.
 */

import { differenceInDays } from "date-fns";
import type { RoomSummary } from "@/types/room";

export interface BookingFormDerived {
  selectedRoom: RoomSummary | undefined;
  pricePerNight: number;
  nights: number;
  totalPrice: number;
  bondAmount: number;
  canProceedToStay: boolean;
  canProceedToSummary: boolean;
}

export function computeBookingFormDerived({
  availableRooms,
  roomId,
  checkIn,
  checkOut,
  bondDeposit,
  guestName,
  guestPhone,
}: {
  availableRooms: RoomSummary[];
  roomId: string;
  checkIn: string;
  checkOut: string;
  bondDeposit: string;
  guestName: string;
  guestPhone: string;
}): BookingFormDerived {
  const selectedRoom = availableRooms.find((r) => r.id === roomId);
  const pricePerNight = selectedRoom
    ? typeof selectedRoom.pricePerNight === "string"
      ? parseFloat(selectedRoom.pricePerNight)
      : selectedRoom.pricePerNight
    : 0;

  const nights =
    checkIn && checkOut
      ? differenceInDays(new Date(checkOut), new Date(checkIn))
      : 0;

  const totalPrice = nights * pricePerNight;
  const bondAmount = bondDeposit ? parseFloat(bondDeposit) : 0;

  return {
    selectedRoom,
    pricePerNight,
    nights,
    totalPrice,
    bondAmount,
    canProceedToStay: Boolean(guestName && guestPhone),
    canProceedToSummary: Boolean(roomId && checkIn && checkOut && nights > 0),
  };
}
