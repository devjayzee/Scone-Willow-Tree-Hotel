"use client";

import { useState, useEffect, useCallback } from "react";
import { format, differenceInDays, addDays, parseISO } from "date-fns";
import type { CreateBookingInput } from "@/types/booking";
import type { RoomSummary } from "@/types/room";
import {
  downloadDraftBookingPDF,
  type BookingPDFData,
} from "@/lib/utils/pdf/booking-registration";

export type BookingStep = "guest" | "stay" | "summary";

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

interface UseBookingFormOptions {
  open: boolean;
  rooms: RoomSummary[];
  onSubmit: (data: CreateBookingInput) => Promise<void>;
  onClose: () => void;
}

export function useBookingForm({
  open,
  rooms,
  onSubmit,
  onClose,
}: UseBookingFormOptions) {
  // Step management
  const [step, setStep] = useState<BookingStep>("guest");

  // Guest details
  const [guestName, setGuestName] = useState("");
  const [guestDateOfBirth, setGuestDateOfBirth] = useState("");
  const [guestAddress, setGuestAddress] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [vehicleRego, setVehicleRego] = useState("");
  const [additionalGuests, setAdditionalGuests] = useState("");

  // Stay details
  const [roomId, setRoomId] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkInTime, setCheckInTime] = useState("14:00");
  const [checkOut, setCheckOut] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("10:00");
  const [bondDeposit, setBondDeposit] = useState("");
  const [notes, setNotes] = useState("");

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [availableRooms, setAvailableRooms] = useState<RoomSummary[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);

  // Fetch available rooms for selected dates
  const fetchAvailableRooms = useCallback(
    async (checkInDate: string, checkOutDate: string) => {
      if (!checkInDate || !checkOutDate) {
        setAvailableRooms(rooms);
        return;
      }

      setIsLoadingRooms(true);
      try {
        const response = await fetch(
          `/api/rooms/available?checkIn=${checkInDate}&checkOut=${checkOutDate}`
        );
        if (response.ok) {
          const data = await response.json();
          setAvailableRooms(data);
        }
      } catch (err) {
        console.error("Failed to fetch available rooms:", err);
        setAvailableRooms(rooms);
      } finally {
        setIsLoadingRooms(false);
      }
    },
    [rooms]
  );

  // Reset form when dialog closes
  const resetForm = useCallback(() => {
    setStep("guest");
    setRoomId("");
    setCheckIn("");
    setCheckInTime("14:00");
    setCheckOut("");
    setCheckOutTime("10:00");
    setBondDeposit("");
    setGuestName("");
    setGuestDateOfBirth("");
    setGuestAddress("");
    setGuestPhone("");
    setGuestEmail("");
    setVehicleRego("");
    setAdditionalGuests("");
    setNotes("");
    setError("");
  }, []);

  // Set default dates when dialog opens
  useEffect(() => {
    if (open) {
      const today = format(new Date(), "yyyy-MM-dd");
      const tomorrow = format(new Date(Date.now() + 86400000), "yyyy-MM-dd");
      setCheckIn(today);
      setCheckOut(tomorrow);
    }
  }, [open]);

  // Fetch available rooms when dates change
  useEffect(() => {
    if (open && checkIn && checkOut) {
      fetchAvailableRooms(checkIn, checkOut);
    }
  }, [checkIn, checkOut, open, fetchAvailableRooms]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open, resetForm]);

  // Handle check-in date change
  const handleCheckInChange = useCallback(
    (newCheckIn: string) => {
      setCheckIn(newCheckIn);
      setRoomId(""); // Clear room when dates change

      // Auto-adjust checkout if it's on or before the new check-in
      if (newCheckIn && checkOut && newCheckIn >= checkOut) {
        const nextDay = format(addDays(parseISO(newCheckIn), 1), "yyyy-MM-dd");
        setCheckOut(nextDay);
      }
    },
    [checkOut]
  );

  // Handle check-out date change
  const handleCheckOutChange = useCallback((newCheckOut: string) => {
    setCheckOut(newCheckOut);
    setRoomId(""); // Clear room when dates change
  }, []);

  // Submit the form
  const handleSubmit = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      await onSubmit({
        roomId,
        guestName,
        guestDateOfBirth: guestDateOfBirth || undefined,
        guestAddress: guestAddress || undefined,
        guestPhone,
        guestEmail: guestEmail || undefined,
        vehicleRego: vehicleRego || undefined,
        additionalGuests: additionalGuests || undefined,
        checkIn,
        checkInTime: checkInTime || undefined,
        checkOut,
        checkOutTime: checkOutTime || undefined,
        bondDeposit: bondDeposit ? parseFloat(bondDeposit) : undefined,
        notes: notes || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [
    onSubmit,
    onClose,
    roomId,
    guestName,
    guestDateOfBirth,
    guestAddress,
    guestPhone,
    guestEmail,
    vehicleRego,
    additionalGuests,
    checkIn,
    checkInTime,
    checkOut,
    checkOutTime,
    bondDeposit,
    notes,
  ]);

  // Computed values
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

  const canProceedToStay = Boolean(guestName && guestPhone);
  const canProceedToSummary = Boolean(roomId && checkIn && checkOut && nights > 0);

  // Generate PDF
  const generatePDF = useCallback(() => {
    const pdfData: BookingPDFData = {
      guestName,
      guestDateOfBirth: guestDateOfBirth || null,
      guestAddress: guestAddress || null,
      guestEmail: guestEmail || null,
      guestPhone,
      vehicleRego: vehicleRego || null,
      additionalGuests: additionalGuests || null,
      checkIn,
      checkInTime: checkInTime || null,
      checkOut,
      checkOutTime: checkOutTime || null,
      bondDeposit: bondDeposit || null,
      roomNumber: selectedRoom?.roomNumber || "",
      pricePerNight,
    };
    downloadDraftBookingPDF(pdfData, guestName || "form");
  }, [
    guestName,
    guestDateOfBirth,
    guestAddress,
    guestEmail,
    guestPhone,
    vehicleRego,
    additionalGuests,
    checkIn,
    checkInTime,
    checkOut,
    checkOutTime,
    bondDeposit,
    selectedRoom,
    pricePerNight,
  ]);

  // Format helpers
  const formatDisplayDate = useCallback((dateStr: string) => {
    if (!dateStr) return "___/___/______";
    return format(parseISO(dateStr), "dd/MM/yyyy");
  }, []);

  const formatDisplayTime = useCallback((timeStr: string) => {
    if (!timeStr) return "______";
    const [hours, minutes] = timeStr.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  }, []);

  return {
    // Step
    step,
    setStep,

    // Guest details
    guest: {
      guestName,
      guestDateOfBirth,
      guestAddress,
      guestPhone,
      guestEmail,
      vehicleRego,
      additionalGuests,
    },
    setGuestName,
    setGuestDateOfBirth,
    setGuestAddress,
    setGuestPhone,
    setGuestEmail,
    setVehicleRego,
    setAdditionalGuests,

    // Stay details
    stay: {
      roomId,
      checkIn,
      checkInTime,
      checkOut,
      checkOutTime,
      bondDeposit,
      notes,
    },
    setRoomId,
    handleCheckInChange,
    setCheckInTime,
    handleCheckOutChange,
    setCheckOutTime,
    setBondDeposit,
    setNotes,

    // Room data
    availableRooms,
    selectedRoom,
    isLoadingRooms,

    // Computed values
    pricePerNight,
    nights,
    totalPrice,
    bondAmount,
    canProceedToStay,
    canProceedToSummary,

    // UI state
    isLoading,
    error,

    // Actions
    handleSubmit,
    generatePDF,

    // Formatters
    formatDisplayDate,
    formatDisplayTime,
  };
}
