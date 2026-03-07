"use client";

import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { GuestDetails } from "@/hooks/use-booking-form";

interface GuestDetailsStepProps {
  guest: GuestDetails;
  onGuestNameChange: (value: string) => void;
  onGuestDateOfBirthChange: (value: string) => void;
  onGuestAddressChange: (value: string) => void;
  onGuestPhoneChange: (value: string) => void;
  onGuestEmailChange: (value: string) => void;
  onVehicleRegoChange: (value: string) => void;
  onAdditionalGuestsChange: (value: string) => void;
}

export function GuestDetailsStep({
  guest,
  onGuestNameChange,
  onGuestDateOfBirthChange,
  onGuestAddressChange,
  onGuestPhoneChange,
  onGuestEmailChange,
  onVehicleRegoChange,
  onAdditionalGuestsChange,
}: GuestDetailsStepProps) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-navy">Guest Details</h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="guestName">Full Name *</Label>
          <Input
            id="guestName"
            value={guest.guestName}
            onChange={(e) => onGuestNameChange(e.target.value)}
            placeholder="Full name"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="guestDateOfBirth">Date of Birth</Label>
          <Input
            id="guestDateOfBirth"
            type="date"
            value={guest.guestDateOfBirth}
            onChange={(e) => onGuestDateOfBirthChange(e.target.value)}
            min="1900-01-01"
            max={format(new Date(), "yyyy-MM-dd")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="guestAddress">Home Address</Label>
        <Input
          id="guestAddress"
          value={guest.guestAddress}
          onChange={(e) => onGuestAddressChange(e.target.value)}
          placeholder="Street address, suburb, state, postcode"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="guestPhone">Mobile Number *</Label>
          <Input
            id="guestPhone"
            type="tel"
            value={guest.guestPhone}
            onChange={(e) => onGuestPhoneChange(e.target.value)}
            placeholder="0400 000 000"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="guestEmail">Email</Label>
          <Input
            id="guestEmail"
            type="email"
            value={guest.guestEmail}
            onChange={(e) => onGuestEmailChange(e.target.value)}
            placeholder="guest@example.com"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="vehicleRego">Vehicle Registration</Label>
        <Input
          id="vehicleRego"
          value={guest.vehicleRego}
          onChange={(e) => onVehicleRegoChange(e.target.value)}
          placeholder="e.g., ABC123"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="additionalGuests">Additional Guests (Full Names)</Label>
        <Textarea
          id="additionalGuests"
          value={guest.additionalGuests}
          onChange={(e) => onAdditionalGuestsChange(e.target.value)}
          placeholder="Enter names of additional guests, one per line"
          rows={2}
        />
      </div>
    </div>
  );
}
