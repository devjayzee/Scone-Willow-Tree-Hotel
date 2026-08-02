/**
 * State reducer for use-booking-form. Kept in a sibling file so the main
 * hook stays under the 300 LOC threshold. Pure — no React imports.
 */

import { format, addDays, parseISO } from "date-fns";
import type { Booking } from "@/types/booking";

export interface GuestDetails {
  guestName: string;
  guestDateOfBirth: string;
  guestAddress: string;
  guestPhone: string;
  guestEmail: string;
  vehicleRego: string;
  additionalGuests: string;
}

export interface StayDetails {
  roomId: string;
  checkIn: string;
  checkInTime: string;
  checkOut: string;
  checkOutTime: string;
  bondDeposit: string;
  notes: string;
}

export type BookingFormState = GuestDetails & StayDetails & { error: string };

export const INITIAL_BOOKING_FORM_STATE: BookingFormState = {
  guestName: "",
  guestDateOfBirth: "",
  guestAddress: "",
  guestPhone: "",
  guestEmail: "",
  vehicleRego: "",
  additionalGuests: "",
  roomId: "",
  checkIn: "",
  checkInTime: "14:00",
  checkOut: "",
  checkOutTime: "10:00",
  bondDeposit: "",
  notes: "",
  error: "",
};

type SetFieldAction<K extends keyof BookingFormState = keyof BookingFormState> = {
  type: "SET_FIELD";
  field: K;
  value: BookingFormState[K];
};

export type BookingFormAction =
  | SetFieldAction
  | { type: "RESET" }
  | { type: "HYDRATE"; booking: Booking }
  | { type: "SEED_DATES"; today: string; tomorrow: string }
  | { type: "CHANGE_CHECK_IN"; value: string }
  | { type: "CHANGE_CHECK_OUT"; value: string };

export function bookingFormReducer(
  state: BookingFormState,
  action: BookingFormAction
): BookingFormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };

    case "RESET":
      return INITIAL_BOOKING_FORM_STATE;

    case "HYDRATE": {
      const b = action.booking;
      return {
        guestName: b.guestName,
        guestDateOfBirth: b.guestDateOfBirth
          ? format(new Date(b.guestDateOfBirth), "yyyy-MM-dd")
          : "",
        guestAddress: b.guestAddress || "",
        guestPhone: b.guestPhone || "",
        guestEmail: b.guestEmail || "",
        vehicleRego: b.vehicleRego || "",
        additionalGuests: b.additionalGuests || "",
        roomId: b.roomId,
        checkIn: format(new Date(b.checkIn), "yyyy-MM-dd"),
        checkInTime: b.checkInTime || "14:00",
        checkOut: format(new Date(b.checkOut), "yyyy-MM-dd"),
        checkOutTime: b.checkOutTime || "10:00",
        bondDeposit: b.bondDeposit?.toString() || "",
        notes: b.notes || "",
        error: "",
      };
    }

    case "SEED_DATES":
      return { ...state, checkIn: action.today, checkOut: action.tomorrow };

    case "CHANGE_CHECK_IN": {
      const next: BookingFormState = {
        ...state,
        checkIn: action.value,
        roomId: "",
      };
      if (action.value && state.checkOut && action.value >= state.checkOut) {
        next.checkOut = format(addDays(parseISO(action.value), 1), "yyyy-MM-dd");
      }
      return next;
    }

    case "CHANGE_CHECK_OUT":
      return { ...state, checkOut: action.value, roomId: "" };
  }
}
