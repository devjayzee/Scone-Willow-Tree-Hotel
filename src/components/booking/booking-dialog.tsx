"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft } from "lucide-react";
import type { CreateBookingInput } from "@/types/booking";
import type { RoomSummary } from "@/types/room";
import { useBookingForm } from "@/hooks/use-booking-form";
import {
  GuestDetailsStep,
  StayDetailsStep,
  BookingSummaryStep,
  StepIndicator,
} from "./steps";

interface BookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: RoomSummary[];
  onSubmit: (data: CreateBookingInput) => Promise<void>;
}

export function BookingDialog({
  open,
  onOpenChange,
  rooms,
  onSubmit,
}: BookingDialogProps) {
  const form = useBookingForm({
    open,
    rooms,
    onSubmit,
    onClose: () => onOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-navy">New Booking</DialogTitle>
          <StepIndicator
            currentStep={form.step}
            canProceedToStay={form.canProceedToStay}
            canProceedToSummary={form.canProceedToSummary}
            onStepChange={form.setStep}
          />
        </DialogHeader>

        {form.error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
            {form.error}
          </div>
        )}

        <div className="pt-4 pb-2 flex-1 overflow-y-auto">
          {form.step === "guest" && (
            <GuestDetailsStep
              guest={form.guest}
              onGuestNameChange={form.setGuestName}
              onGuestDateOfBirthChange={form.setGuestDateOfBirth}
              onGuestAddressChange={form.setGuestAddress}
              onGuestPhoneChange={form.setGuestPhone}
              onGuestEmailChange={form.setGuestEmail}
              onVehicleRegoChange={form.setVehicleRego}
              onAdditionalGuestsChange={form.setAdditionalGuests}
            />
          )}

          {form.step === "stay" && (
            <StayDetailsStep
              stay={form.stay}
              availableRooms={form.availableRooms}
              selectedRoom={form.selectedRoom}
              isLoadingRooms={form.isLoadingRooms}
              nights={form.nights}
              pricePerNight={form.pricePerNight}
              onCheckInChange={form.handleCheckInChange}
              onCheckInTimeChange={form.setCheckInTime}
              onCheckOutChange={form.handleCheckOutChange}
              onCheckOutTimeChange={form.setCheckOutTime}
              onRoomIdChange={form.setRoomId}
              onBondDepositChange={form.setBondDeposit}
              onNotesChange={form.setNotes}
            />
          )}

          {form.step === "summary" && (
            <BookingSummaryStep
              guest={form.guest}
              stay={form.stay}
              selectedRoom={form.selectedRoom}
              nights={form.nights}
              pricePerNight={form.pricePerNight}
              totalPrice={form.totalPrice}
              bondAmount={form.bondAmount}
              formatDisplayDate={form.formatDisplayDate}
              formatDisplayTime={form.formatDisplayTime}
              onGeneratePDF={form.generatePDF}
            />
          )}
        </div>

        <DialogFooter className="gap-2 border-t pt-4 mt-2">
          {form.step !== "guest" && (
            <Button
              type="button"
              variant="outline"
              onClick={() => form.setStep(form.step === "summary" ? "stay" : "guest")}
              disabled={form.isLoading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}

          {form.step === "guest" && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          )}

          {form.step === "guest" && (
            <Button
              type="button"
              onClick={() => form.setStep("stay")}
              disabled={!form.canProceedToStay}
              className="bg-navy hover:bg-navy-dark text-cream"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          {form.step === "stay" && (
            <Button
              type="button"
              onClick={() => form.setStep("summary")}
              disabled={!form.canProceedToSummary}
              className="bg-navy hover:bg-navy-dark text-cream"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          {form.step === "summary" && (
            <Button
              type="button"
              onClick={form.handleSubmit}
              className="bg-navy hover:bg-navy-dark text-cream"
              disabled={form.isLoading}
            >
              {form.isLoading ? "Creating..." : "Create Booking"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
