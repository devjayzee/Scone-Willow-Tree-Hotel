"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format, differenceInDays } from "date-fns";
import {
  CalendarDays,
  Mail,
  Phone,
  User,
  BedDouble,
  FileText,
  MapPin,
  Car,
  Users,
  Clock,
  Cake,
} from "lucide-react";
import type { Booking } from "@/types/booking";

interface BookingDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking | null;
}

export function BookingDetailsDialog({
  open,
  onOpenChange,
  booking,
}: BookingDetailsDialogProps) {
  if (!booking) return null;

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "EEE, MMM d, yyyy");
  };

  const formatDOB = (dateString: string) => {
    return format(new Date(dateString), "MMMM d, yyyy");
  };

  const formatTime = (timeStr: string | null | undefined) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const nights = differenceInDays(new Date(booking.checkOut), new Date(booking.checkIn));

  const pricePerNight =
    typeof booking.room.pricePerNight === "string"
      ? parseFloat(booking.room.pricePerNight)
      : booking.room.pricePerNight;

  const totalPrice = nights * pricePerNight;

  const bondDeposit = booking.bondDeposit
    ? typeof booking.bondDeposit === "string"
      ? parseFloat(booking.bondDeposit)
      : booking.bondDeposit
    : 0;

  const additionalGuestsList = booking.additionalGuests
    ? booking.additionalGuests.split("\n").filter(g => g.trim())
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 border-b px-6 py-4">
          <DialogHeader>
            <DialogTitle className="text-navy text-lg">
              {booking.bookingRef}
            </DialogTitle>
          </DialogHeader>

          {/* Room Card */}
          <div className="mt-4 flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-navy/10 flex items-center justify-center">
              <BedDouble className="h-6 w-6 text-navy" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-lg">
                Room {booking.room.roomNumber}
              </p>
              <p className="text-sm text-gray-500">
                ${pricePerNight}/night · {nights} night{nights !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Stay Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <CalendarDays className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Check In</span>
              </div>
              <p className="font-semibold text-gray-900">{formatDate(booking.checkIn)}</p>
              {booking.checkInTime && (
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3" /> {formatTime(booking.checkInTime)}
                </p>
              )}
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <CalendarDays className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Check Out</span>
              </div>
              <p className="font-semibold text-gray-900">{formatDate(booking.checkOut)}</p>
              {booking.checkOutTime && (
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3" /> {formatTime(booking.checkOutTime)}
                </p>
              )}
            </div>
          </div>

          {/* Guest Information */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Guest Information</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-navy/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-navy" />
                </div>
                <span className="font-medium text-gray-900">{booking.guestName}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pl-11">
                {booking.guestDateOfBirth && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Cake className="h-3.5 w-3.5 text-gray-400" />
                    <span>{formatDOB(booking.guestDateOfBirth)}</span>
                  </div>
                )}
                {booking.guestPhone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-3.5 w-3.5 text-gray-400" />
                    <span>{booking.guestPhone}</span>
                  </div>
                )}
              </div>

              <div className="pl-11 space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="h-3.5 w-3.5 text-gray-400" />
                  <span>{booking.guestEmail}</span>
                </div>
                {booking.guestAddress && (
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5" />
                    <span>{booking.guestAddress}</span>
                  </div>
                )}
                {booking.vehicleRego && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Car className="h-3.5 w-3.5 text-gray-400" />
                    <span>{booking.vehicleRego}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Additional Guests */}
          {additionalGuestsList.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Additional Guests ({additionalGuestsList.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {additionalGuestsList.map((guest, index) => (
                  <span
                    key={index}
                    className="px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 text-sm rounded-full"
                  >
                    {guest}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {booking.notes && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" />
                Notes
              </h4>
              <p className="text-sm text-gray-600 bg-gray-50 border border-gray-100 p-3 rounded-lg">
                {booking.notes}
              </p>
            </div>
          )}

          {/* Payment Summary */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                ${pricePerNight} × {nights} night{nights !== 1 ? "s" : ""}
              </span>
              <span className="text-gray-900">${totalPrice.toFixed(2)}</span>
            </div>
            {bondDeposit > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Bond/Deposit</span>
                <span className="text-gray-900">${bondDeposit.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-navy pt-2 border-t border-gray-200">
              <span>Total</span>
              <span>${(totalPrice + bondDeposit).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
