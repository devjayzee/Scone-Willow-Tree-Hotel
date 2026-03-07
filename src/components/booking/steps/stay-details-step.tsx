"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RoomSummary } from "@/types/room";
import type { StayDetails } from "@/hooks/use-booking-form";

interface StayDetailsStepProps {
  stay: StayDetails;
  availableRooms: RoomSummary[];
  selectedRoom: RoomSummary | undefined;
  isLoadingRooms: boolean;
  nights: number;
  pricePerNight: number;
  onCheckInChange: (value: string) => void;
  onCheckInTimeChange: (value: string) => void;
  onCheckOutChange: (value: string) => void;
  onCheckOutTimeChange: (value: string) => void;
  onRoomIdChange: (value: string) => void;
  onBondDepositChange: (value: string) => void;
  onNotesChange: (value: string) => void;
}

export function StayDetailsStep({
  stay,
  availableRooms,
  selectedRoom,
  isLoadingRooms,
  nights,
  pricePerNight,
  onCheckInChange,
  onCheckInTimeChange,
  onCheckOutChange,
  onCheckOutTimeChange,
  onRoomIdChange,
  onBondDepositChange,
  onNotesChange,
}: StayDetailsStepProps) {
  const { checkIn, checkInTime, checkOut, checkOutTime, roomId, bondDeposit, notes } = stay;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-navy">Stay Details</h3>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="checkIn">Check-in Date *</Label>
          <Input
            id="checkIn"
            type="date"
            value={checkIn}
            onChange={(e) => onCheckInChange(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="checkInTime">Est. Time of Arrival</Label>
          <Input
            id="checkInTime"
            type="time"
            value={checkInTime}
            onChange={(e) => onCheckInTimeChange(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="checkOut">Check-out Date *</Label>
          <Input
            id="checkOut"
            type="date"
            value={checkOut}
            onChange={(e) => onCheckOutChange(e.target.value)}
            min={checkIn}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="checkOutTime">Est. Time of Departure</Label>
          <Input
            id="checkOutTime"
            type="time"
            value={checkOutTime}
            onChange={(e) => onCheckOutTimeChange(e.target.value)}
          />
        </div>
      </div>

      {/* Room Selection */}
      <div className="space-y-2">
        <Label htmlFor="room">Room *</Label>
        <Select
          value={roomId}
          onValueChange={onRoomIdChange}
          required
          disabled={!checkIn || !checkOut || isLoadingRooms}
        >
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={
                !checkIn || !checkOut
                  ? "Select dates first"
                  : isLoadingRooms
                    ? "Checking availability..."
                    : availableRooms.length === 0
                      ? "No rooms available for selected dates"
                      : "Select a room"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {availableRooms.map((room) => (
              <SelectItem key={room.id} value={room.id}>
                Room {room.roomNumber} - {room.description || "Standard Room"} ($
                {typeof room.pricePerNight === "string"
                  ? parseFloat(room.pricePerNight).toFixed(0)
                  : room.pricePerNight.toFixed(0)}
                /night)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {availableRooms.length === 0 && !isLoadingRooms && checkIn && checkOut && (
          <p className="text-sm text-amber-600">
            All rooms are booked for the selected dates. Please choose different dates.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Number of Nights</Label>
          <Input value={nights > 0 ? nights : "-"} disabled />
        </div>
        <div className="space-y-2">
          <Label>Room Rate</Label>
          <Input value={selectedRoom ? `$${pricePerNight}/night` : "-"} disabled />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bondDeposit">Bond/Deposit (if applicable)</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
          <Input
            id="bondDeposit"
            type="number"
            min="0"
            step="0.01"
            value={bondDeposit}
            onChange={(e) => onBondDepositChange(e.target.value)}
            className="pl-7"
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Special requests, arrival info, etc."
          rows={2}
        />
      </div>
    </div>
  );
}
