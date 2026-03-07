"use client";

import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import type { RoomSummary } from "@/types/room";
import type { GuestDetails, StayDetails } from "@/hooks/use-booking-form";

interface BookingSummaryStepProps {
  guest: GuestDetails;
  stay: StayDetails;
  selectedRoom: RoomSummary | undefined;
  nights: number;
  pricePerNight: number;
  totalPrice: number;
  bondAmount: number;
  formatDisplayDate: (dateStr: string) => string;
  formatDisplayTime: (timeStr: string) => string;
  onGeneratePDF: () => void;
}

export function BookingSummaryStep({
  guest,
  stay,
  selectedRoom,
  nights,
  pricePerNight,
  totalPrice,
  bondAmount,
  formatDisplayDate,
  formatDisplayTime,
  onGeneratePDF,
}: BookingSummaryStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-navy">Booking Summary</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onGeneratePDF}
          className="gap-2"
        >
          <FileDown className="h-4 w-4" />
          Download Registration Form
        </Button>
      </div>

      {/* Guest Summary */}
      <div className="bg-gray-50 p-4 rounded-lg space-y-2">
        <h4 className="font-medium text-navy text-sm">Guest Details</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span className="text-gray-500">Name:</span>
          <span>{guest.guestName}</span>
          {guest.guestDateOfBirth && (
            <>
              <span className="text-gray-500">Date of Birth:</span>
              <span>{formatDisplayDate(guest.guestDateOfBirth)}</span>
            </>
          )}
          {guest.guestAddress && (
            <>
              <span className="text-gray-500">Address:</span>
              <span>{guest.guestAddress}</span>
            </>
          )}
          {guest.guestPhone && (
            <>
              <span className="text-gray-500">Mobile:</span>
              <span>{guest.guestPhone}</span>
            </>
          )}
          <span className="text-gray-500">Email:</span>
          <span>{guest.guestEmail}</span>
          {guest.vehicleRego && (
            <>
              <span className="text-gray-500">Vehicle:</span>
              <span>{guest.vehicleRego}</span>
            </>
          )}
          {guest.additionalGuests && (
            <>
              <span className="text-gray-500">Additional Guests:</span>
              <span className="whitespace-pre-line">{guest.additionalGuests}</span>
            </>
          )}
        </div>
      </div>

      {/* Stay Summary */}
      <div className="bg-gray-50 p-4 rounded-lg space-y-2">
        <h4 className="font-medium text-navy text-sm">Stay Details</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span className="text-gray-500">Room:</span>
          <span>
            Room {selectedRoom?.roomNumber} - {selectedRoom?.description || "Standard"}
          </span>
          <span className="text-gray-500">Check-in:</span>
          <span>
            {formatDisplayDate(stay.checkIn)} at {formatDisplayTime(stay.checkInTime)}
          </span>
          <span className="text-gray-500">Check-out:</span>
          <span>
            {formatDisplayDate(stay.checkOut)} at {formatDisplayTime(stay.checkOutTime)}
          </span>
          <span className="text-gray-500">Duration:</span>
          <span>
            {nights} night{nights !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Price Summary */}
      <div className="bg-cream/50 p-4 rounded-lg space-y-2">
        <h4 className="font-medium text-navy text-sm">Payment Summary</h4>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">
              Room {selectedRoom?.roomNumber} × {nights} night{nights !== 1 ? "s" : ""} @ $
              {pricePerNight}/night
            </span>
            <span>${totalPrice.toFixed(2)}</span>
          </div>
          {bondAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Bond/Deposit</span>
              <span>${bondAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-navy pt-2 border-t">
            <span>Total</span>
            <span>${(totalPrice + bondAmount).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {stay.notes && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium text-navy text-sm mb-1">Notes</h4>
          <p className="text-sm text-gray-600">{stay.notes}</p>
        </div>
      )}
    </div>
  );
}
