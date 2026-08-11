"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { format } from "date-fns";
import { useAvailableRooms } from "@/hooks/room";
import type { CreateBookingInput, Booking } from "@/types/booking";
import type { RoomSummary } from "@/types/room";
import {
  downloadDraftBookingPDF,
  type BookingPDFData,
} from "@/lib/utils/pdf/booking-registration/index";
import { formatDisplayDate, formatDisplayTime } from "@/lib/utils/format-date";
import {
  bookingFormReducer,
  INITIAL_BOOKING_FORM_STATE,
  type BookingFormState,
  type GuestDetails,
  type StayDetails,
} from "./use-booking-form-reducer";
import { computeBookingFormDerived } from "./use-booking-form-derived";

export type BookingStep = "guest" | "stay" | "summary";
export type { GuestDetails, StayDetails };

interface UseBookingFormOptions {
  open: boolean;
  rooms: RoomSummary[];
  onSubmit: (data: CreateBookingInput) => Promise<void>;
  onClose: () => void;
  initialBooking?: Booking | null;
}

export function useBookingForm({
  open,
  rooms,
  onSubmit,
  onClose,
  initialBooking,
}: UseBookingFormOptions) {
  const isEditMode = Boolean(initialBooking);

  const [step, setStep] = useState<BookingStep>("guest");
  const [isLoading, setIsLoading] = useState(false);
  const [state, dispatch] = useReducer(
    bookingFormReducer,
    INITIAL_BOOKING_FORM_STATE
  );

  const availableRoomsQuery = useAvailableRooms(state.checkIn, state.checkOut);
  const availableRooms: RoomSummary[] = availableRoomsQuery.data ?? rooms;
  const isLoadingRooms = availableRoomsQuery.isLoading;

  useEffect(() => {
    if (!open) return;
    if (initialBooking) {
      dispatch({ type: "HYDRATE", booking: initialBooking });
    } else {
      const today = format(new Date(), "yyyy-MM-dd");
      const tomorrow = format(new Date(Date.now() + 86400000), "yyyy-MM-dd");
      dispatch({ type: "SEED_DATES", today, tomorrow });
    }
  }, [open, initialBooking]);

  useEffect(() => {
    if (!open) {
      setStep("guest");
      dispatch({ type: "RESET" });
    }
  }, [open]);

  // Field setters — thin dispatch wrappers so the public API stays identical.
  const setField = useCallback(
    <K extends keyof BookingFormState>(field: K, value: BookingFormState[K]) => {
      dispatch({ type: "SET_FIELD", field, value });
    },
    []
  );

  const setGuestName = useCallback((v: string) => setField("guestName", v), [setField]);
  const setGuestDateOfBirth = useCallback((v: string) => setField("guestDateOfBirth", v), [setField]);
  const setGuestAddress = useCallback((v: string) => setField("guestAddress", v), [setField]);
  const setGuestPhone = useCallback((v: string) => setField("guestPhone", v), [setField]);
  const setGuestEmail = useCallback((v: string) => setField("guestEmail", v), [setField]);
  const setVehicleRego = useCallback((v: string) => setField("vehicleRego", v), [setField]);
  const setAdditionalGuests = useCallback((v: string) => setField("additionalGuests", v), [setField]);
  const setRoomId = useCallback((v: string) => setField("roomId", v), [setField]);
  const setCheckInTime = useCallback((v: string) => setField("checkInTime", v), [setField]);
  const setCheckOutTime = useCallback((v: string) => setField("checkOutTime", v), [setField]);
  const setBondDeposit = useCallback((v: string) => setField("bondDeposit", v), [setField]);
  const setNotes = useCallback((v: string) => setField("notes", v), [setField]);

  const handleCheckInChange = useCallback(
    (v: string) => dispatch({ type: "CHANGE_CHECK_IN", value: v }),
    []
  );
  const handleCheckOutChange = useCallback(
    (v: string) => dispatch({ type: "CHANGE_CHECK_OUT", value: v }),
    []
  );

  const handleSubmit = useCallback(async () => {
    dispatch({ type: "SET_FIELD", field: "error", value: "" });
    setIsLoading(true);

    try {
      await onSubmit({
        roomId: state.roomId,
        guestName: state.guestName,
        guestDateOfBirth: state.guestDateOfBirth || undefined,
        guestAddress: state.guestAddress || undefined,
        guestPhone: state.guestPhone,
        guestEmail: state.guestEmail || undefined,
        vehicleRego: state.vehicleRego || undefined,
        additionalGuests: state.additionalGuests || undefined,
        checkIn: state.checkIn,
        checkInTime: state.checkInTime || undefined,
        checkOut: state.checkOut,
        checkOutTime: state.checkOutTime || undefined,
        bondDeposit: state.bondDeposit ? parseFloat(state.bondDeposit) : undefined,
        notes: state.notes || undefined,
      });
      onClose();
    } catch (err) {
      dispatch({
        type: "SET_FIELD",
        field: "error",
        value: err instanceof Error ? err.message : "An error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  }, [onSubmit, onClose, state]);

  const derived = computeBookingFormDerived({
    availableRooms,
    roomId: state.roomId,
    checkIn: state.checkIn,
    checkOut: state.checkOut,
    bondDeposit: state.bondDeposit,
    guestName: state.guestName,
    guestPhone: state.guestPhone,
  });

  const generatePDF = useCallback(() => {
    const pdfData: BookingPDFData = {
      guestName: state.guestName,
      guestDateOfBirth: state.guestDateOfBirth || null,
      guestAddress: state.guestAddress || null,
      guestEmail: state.guestEmail || null,
      guestPhone: state.guestPhone,
      vehicleRego: state.vehicleRego || null,
      additionalGuests: state.additionalGuests || null,
      checkIn: state.checkIn,
      checkInTime: state.checkInTime || null,
      checkOut: state.checkOut,
      checkOutTime: state.checkOutTime || null,
      bondDeposit: state.bondDeposit || null,
      roomNumber: derived.selectedRoom?.roomNumber || "",
      pricePerNight: derived.pricePerNight,
    };
    downloadDraftBookingPDF(pdfData, state.guestName || "form");
  }, [state, derived.selectedRoom, derived.pricePerNight]);

  return {
    isEditMode,
    step,
    setStep,
    guest: {
      guestName: state.guestName,
      guestDateOfBirth: state.guestDateOfBirth,
      guestAddress: state.guestAddress,
      guestPhone: state.guestPhone,
      guestEmail: state.guestEmail,
      vehicleRego: state.vehicleRego,
      additionalGuests: state.additionalGuests,
    },
    setGuestName,
    setGuestDateOfBirth,
    setGuestAddress,
    setGuestPhone,
    setGuestEmail,
    setVehicleRego,
    setAdditionalGuests,
    stay: {
      roomId: state.roomId,
      checkIn: state.checkIn,
      checkInTime: state.checkInTime,
      checkOut: state.checkOut,
      checkOutTime: state.checkOutTime,
      bondDeposit: state.bondDeposit,
      notes: state.notes,
    },
    setRoomId,
    handleCheckInChange,
    setCheckInTime,
    handleCheckOutChange,
    setCheckOutTime,
    setBondDeposit,
    setNotes,
    availableRooms,
    selectedRoom: derived.selectedRoom,
    isLoadingRooms,
    pricePerNight: derived.pricePerNight,
    nights: derived.nights,
    totalPrice: derived.totalPrice,
    bondAmount: derived.bondAmount,
    canProceedToStay: derived.canProceedToStay,
    canProceedToSummary: derived.canProceedToSummary,
    isLoading,
    error: state.error,
    handleSubmit,
    generatePDF,
    formatDisplayDate,
    formatDisplayTime,
  };
}
