"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { format, differenceInDays, addDays, parseISO } from "date-fns";
import { FileDown, ChevronRight, ChevronLeft } from "lucide-react";
import { jsPDF } from "jspdf";

interface Room {
  id: string;
  roomNumber: string;
  roomType: string | null;
  pricePerNight: string | number;
  description: string | null;
}

interface BookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: Room[];
  onSubmit: (data: {
    roomId: string;
    guestName: string;
    guestDateOfBirth?: string;
    guestAddress?: string;
    guestPhone?: string;
    guestEmail: string;
    vehicleRego?: string;
    additionalGuests?: string;
    checkIn: string;
    checkInTime?: string;
    checkOut: string;
    checkOutTime?: string;
    bondDeposit?: number;
    notes?: string;
  }) => Promise<void>;
}

type Step = "guest" | "stay" | "summary";

export function BookingDialog({
  open,
  onOpenChange,
  rooms,
  onSubmit,
}: BookingDialogProps) {
  const [step, setStep] = useState<Step>("guest");

  // Stay Details
  const [roomId, setRoomId] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkInTime, setCheckInTime] = useState("14:00");
  const [checkOut, setCheckOut] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("10:00");
  const [bondDeposit, setBondDeposit] = useState("");

  // Guest Details
  const [guestName, setGuestName] = useState("");
  const [guestDateOfBirth, setGuestDateOfBirth] = useState("");
  const [guestAddress, setGuestAddress] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [vehicleRego, setVehicleRego] = useState("");
  const [additionalGuests, setAdditionalGuests] = useState("");
  const [notes, setNotes] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
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
          `/api/rooms/available?checkIn=${checkInDate}&checkOut=${checkOutDate}`,
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
    [rooms],
  );

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

  const resetForm = () => {
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
  };

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  const handleSubmit = async () => {
    setError("");
    setIsLoading(true);

    try {
      await onSubmit({
        roomId,
        guestName,
        guestDateOfBirth: guestDateOfBirth || undefined,
        guestAddress: guestAddress || undefined,
        guestPhone: guestPhone || undefined,
        guestEmail,
        vehicleRego: vehicleRego || undefined,
        additionalGuests: additionalGuests || undefined,
        checkIn,
        checkInTime: checkInTime || undefined,
        checkOut,
        checkOutTime: checkOutTime || undefined,
        bondDeposit: bondDeposit ? parseFloat(bondDeposit) : undefined,
        notes: notes || undefined,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

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

  const canProceedToStay = guestName && guestEmail;
  const canProceedToSummary = roomId && checkIn && checkOut && nights > 0;

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return "___/___/______";
    return format(parseISO(dateStr), "dd/MM/yyyy");
  };

  const formatDisplayTime = (timeStr: string) => {
    if (!timeStr) return "______";
    const [hours, minutes] = timeStr.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 25;
    let y = 15;

    // Use black color throughout
    doc.setTextColor(0, 0, 0);

    // Header - Times New Roman, Bold, Centered
    doc.setFontSize(14);
    doc.setFont("times", "bold");
    doc.text("SCONE WILLOW TREE HOTEL", pageWidth / 2, y, { align: "center" });
    y += 6;

    doc.setFontSize(12);
    doc.setFont("times", "normal");
    doc.text("Guest Registration", pageWidth / 2, y, { align: "center" });
    y += 5;
    doc.text("136 Kelly St, Scone NSW 2337", pageWidth / 2, y, {
      align: "center",
    });
    y += 3;
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // GUEST DETAILS - Times New Roman Bold
    doc.setFontSize(12);
    doc.setFont("times", "bold");
    doc.text("GUEST DETAILS", margin, y);
    y += 7;

    doc.setFontSize(11);
    const labelOffset = 2; // Small gap after label

    // Full Name
    doc.setFont("times", "normal");
    const fullNameLabel = "Full Name:";
    doc.text(fullNameLabel, margin, y);
    const fullNameX = margin + doc.getTextWidth(fullNameLabel) + labelOffset;
    doc.line(fullNameX, y + 1, pageWidth - margin, y + 1);
    doc.setFont("times", "bold");
    if (guestName) doc.text(guestName, fullNameX + 2, y);
    y += 7;

    // Date of Birth
    doc.setFont("times", "normal");
    const dobLabel = "Date of Birth:";
    doc.text(dobLabel, margin, y);
    const dobX = margin + doc.getTextWidth(dobLabel) + labelOffset;
    doc.line(dobX, y + 1, dobX + 28, y + 1);
    doc.setFont("times", "bold");
    if (guestDateOfBirth) {
      doc.text(formatDisplayDate(guestDateOfBirth), dobX + 2, y);
    }
    y += 7;

    // Home Address
    doc.setFont("times", "normal");
    const addressLabel = "Home Address:";
    doc.text(addressLabel, margin, y);
    const addressX = margin + doc.getTextWidth(addressLabel) + labelOffset;
    doc.line(addressX, y + 1, pageWidth - margin, y + 1);
    doc.setFont("times", "bold");
    if (guestAddress) doc.text(guestAddress, addressX + 2, y);
    y += 7;

    // Mobile Number and Email
    doc.setFont("times", "normal");
    const mobileLabel = "Mobile Number:";
    doc.text(mobileLabel, margin, y);
    const mobileX = margin + doc.getTextWidth(mobileLabel) + labelOffset;
    doc.line(mobileX, y + 1, 95, y + 1);
    doc.setFont("times", "bold");
    if (guestPhone) doc.text(guestPhone, mobileX + 2, y);
    doc.setFont("times", "normal");
    const emailLabel = "Email:";
    doc.text(emailLabel, 100, y);
    const emailX = 100 + doc.getTextWidth(emailLabel) + labelOffset;
    doc.line(emailX, y + 1, pageWidth - margin, y + 1);
    doc.setFont("times", "bold");
    if (guestEmail) doc.text(guestEmail, emailX + 2, y);
    y += 7;

    // Vehicle Registration
    doc.setFont("times", "normal");
    const vehicleLabel = "Vehicle Registration:";
    doc.text(vehicleLabel, margin, y);
    const vehicleX = margin + doc.getTextWidth(vehicleLabel) + labelOffset;
    doc.line(vehicleX, y + 1, 100, y + 1);
    doc.setFont("times", "bold");
    if (vehicleRego) doc.text(vehicleRego, vehicleX + 2, y);
    y += 7;

    // Additional Guests (comma-separated)
    doc.setFont("times", "normal");
    const guestsLabel = "Additional Guests (Full Names):";
    doc.text(guestsLabel, margin, y);
    const guestsX = margin + doc.getTextWidth(guestsLabel) + labelOffset;
    doc.line(guestsX, y + 1, pageWidth - margin, y + 1);
    doc.setFont("times", "bold");
    if (additionalGuests) {
      const guestsList = additionalGuests.split("\n").filter(g => g.trim()).join(", ");
      doc.text(guestsList, guestsX + 2, y);
    }
    y += 12;

    // STAY DETAILS - Times New Roman Bold
    y += 3;
    doc.setFontSize(12);
    doc.setFont("times", "bold");
    doc.text("STAY DETAILS", margin, y);
    y += 7;

    doc.setFontSize(11);

    // Room Number
    doc.setFont("times", "normal");
    const roomLabel = "Room Number:";
    doc.text(roomLabel, margin, y);
    const roomX = margin + doc.getTextWidth(roomLabel) + labelOffset;
    doc.line(roomX, y + 1, roomX + 20, y + 1);
    doc.setFont("times", "bold");
    if (selectedRoom) doc.text(selectedRoom.roomNumber, roomX + 2, y);
    y += 7;

    // Check-in Date and Time
    doc.setFont("times", "normal");
    const checkInLabel = "Check-in Date:";
    doc.text(checkInLabel, margin, y);
    const checkInX = margin + doc.getTextWidth(checkInLabel) + labelOffset;
    doc.line(checkInX, y + 1, checkInX + 26, y + 1);
    doc.setFont("times", "bold");
    if (checkIn) doc.text(formatDisplayDate(checkIn), checkInX + 2, y);
    doc.setFont("times", "normal");
    const timeLabel1 = "Time:";
    doc.text(timeLabel1, 100, y);
    const timeX1 = 100 + doc.getTextWidth(timeLabel1) + labelOffset;
    doc.line(timeX1, y + 1, timeX1 + 22, y + 1);
    doc.setFont("times", "bold");
    if (checkInTime) doc.text(formatDisplayTime(checkInTime), timeX1 + 2, y);
    y += 7;

    // Check-out Date and Time
    doc.setFont("times", "normal");
    const checkOutLabel = "Check-out Date:";
    doc.text(checkOutLabel, margin, y);
    const checkOutX = margin + doc.getTextWidth(checkOutLabel) + labelOffset;
    doc.line(checkOutX, y + 1, checkOutX + 26, y + 1);
    doc.setFont("times", "bold");
    if (checkOut) doc.text(formatDisplayDate(checkOut), checkOutX + 2, y);
    doc.setFont("times", "normal");
    doc.text(timeLabel1, 100, y);
    doc.line(timeX1, y + 1, timeX1 + 22, y + 1);
    doc.setFont("times", "bold");
    if (checkOutTime) doc.text(formatDisplayTime(checkOutTime), timeX1 + 2, y);
    y += 7;

    // Number of Nights and Room Rate
    doc.setFont("times", "normal");
    const nightsLabel = "Number of Nights:";
    doc.text(nightsLabel, margin, y);
    const nightsX = margin + doc.getTextWidth(nightsLabel) + labelOffset;
    doc.line(nightsX, y + 1, nightsX + 12, y + 1);
    doc.setFont("times", "bold");
    doc.text(nights.toString(), nightsX + 2, y);
    doc.setFont("times", "normal");
    const rateLabel = "Room Rate: $";
    doc.text(rateLabel, 85, y);
    const rateX = 85 + doc.getTextWidth(rateLabel) + labelOffset;
    doc.line(rateX, y + 1, rateX + 14, y + 1);
    doc.setFont("times", "bold");
    doc.text(pricePerNight.toFixed(0), rateX + 2, y);
    doc.setFont("times", "normal");
    doc.text("per night", rateX + 16, y);
    y += 7;

    // Bond/Deposit
    doc.setFont("times", "normal");
    const bondLabel = "Bond/Deposit (if applicable): $";
    doc.text(bondLabel, margin, y);
    const bondX = margin + doc.getTextWidth(bondLabel) + labelOffset;
    doc.line(bondX, y + 1, bondX + 16, y + 1);
    doc.setFont("times", "bold");
    doc.text(bondDeposit || "0", bondX + 2, y);
    y += 9;

    // TERMS & CONDITIONS - Times New Roman Bold
    y += 3;
    doc.setFontSize(12);
    doc.setFont("times", "bold");
    doc.text("TERMS & CONDITIONS", margin, y);
    y += 6;

    doc.setFontSize(11);
    doc.setFont("times", "normal");

    const terms = [
      "1.  Check-in time is from 3:00 PM. Check-out time is strictly by 10:00 AM. Late check-out fees may apply.",
      "2.  This is a STRICTLY NON-SMOKING facility.",
      "3.  Only registered guests are permitted to stay overnight.",
      "4.  Guests must keep noise to a minimum after 10:00 PM to respect other guests.",
      "5.  Any damage, loss, or excessive cleaning required will be charged to the registered guest.",
      "6.  Management reserves the right to refuse service or evict guests breaching hotel policy without refund.",
      "7.  The hotel is not responsible for loss or damage to personal belongings unless caused by proven negligence.",
    ];

    terms.forEach((term) => {
      const lines = doc.splitTextToSize(term, pageWidth - margin * 2);
      doc.text(lines, margin, y);
      y += lines.length * 5 + 1;
    });
    y += 6;

    // PAYMENT AUTHORISATION - Times New Roman Bold
    doc.setFontSize(12);
    doc.setFont("times", "bold");
    doc.text("PAYMENT AUTHORISATION", margin, y);
    y += 6;

    doc.setFontSize(11);
    doc.setFont("times", "normal");
    const paymentText =
      "I authorise Willow Tree Inn to charge accommodation fees and any additional charges (damages, late checkout, cleaning fees, lost keys) to my nominated payment method.";
    const paymentLines = doc.splitTextToSize(
      paymentText,
      pageWidth - margin * 2,
    );
    doc.text(paymentLines, margin, y);
    y += paymentLines.length * 5 + 7;

    // Cardholder Name
    doc.setFont("times", "normal");
    const cardLabel = "Cardholder Name:";
    doc.text(cardLabel, margin, y);
    const cardX = margin + doc.getTextWidth(cardLabel) + labelOffset;
    doc.line(cardX, y + 1, pageWidth - margin, y + 1);
    y += 10;

    // Signature and Date
    const sigLabel = "Signature:";
    doc.text(sigLabel, margin, y);
    const sigX = margin + doc.getTextWidth(sigLabel) + labelOffset;
    doc.line(sigX, y + 1, 100, y + 1);
    const dateLabel = "Date:";
    doc.text(dateLabel, 110, y);
    const dateX = 110 + doc.getTextWidth(dateLabel) + labelOffset;
    doc.line(dateX, y + 1, pageWidth - margin, y + 1);

    // Save PDF
    doc.save(
      `guest-registration-${guestName.replace(/\s+/g, "-").toLowerCase() || "form"}.pdf`,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-navy">New Booking</DialogTitle>
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 pt-4">
            <button
              type="button"
              onClick={() => setStep("guest")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                step === "guest"
                  ? "bg-navy text-cream"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">
                1
              </span>
              Guest
            </button>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <button
              type="button"
              onClick={() => canProceedToStay && setStep("stay")}
              disabled={!canProceedToStay}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                step === "stay"
                  ? "bg-navy text-cream"
                  : canProceedToStay
                    ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    : "bg-gray-50 text-gray-400 cursor-not-allowed"
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">
                2
              </span>
              Stay
            </button>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <button
              type="button"
              onClick={() =>
                canProceedToStay && canProceedToSummary && setStep("summary")
              }
              disabled={!canProceedToStay || !canProceedToSummary}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                step === "summary"
                  ? "bg-navy text-cream"
                  : canProceedToStay && canProceedToSummary
                    ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    : "bg-gray-50 text-gray-400 cursor-not-allowed"
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">
                3
              </span>
              Summary
            </button>
          </div>
        </DialogHeader>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
            {error}
          </div>
        )}

        <div className="pt-4 pb-2 flex-1 overflow-y-auto">
          {/* Step 1: Guest Details */}
          {step === "guest" && (
            <div className="space-y-4">
              <h3 className="font-semibold text-navy">Guest Details</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="guestName">Full Name *</Label>
                  <Input
                    id="guestName"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Full name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guestDateOfBirth">Date of Birth</Label>
                  <Input
                    id="guestDateOfBirth"
                    type="date"
                    value={guestDateOfBirth}
                    onChange={(e) => setGuestDateOfBirth(e.target.value)}
                    min="1900-01-01"
                    max={format(new Date(), "yyyy-MM-dd")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="guestAddress">Home Address</Label>
                <Input
                  id="guestAddress"
                  value={guestAddress}
                  onChange={(e) => setGuestAddress(e.target.value)}
                  placeholder="Street address, suburb, state, postcode"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="guestPhone">Mobile Number</Label>
                  <Input
                    id="guestPhone"
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="0400 000 000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guestEmail">Email *</Label>
                  <Input
                    id="guestEmail"
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="guest@example.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicleRego">Vehicle Registration</Label>
                <Input
                  id="vehicleRego"
                  value={vehicleRego}
                  onChange={(e) => setVehicleRego(e.target.value)}
                  placeholder="e.g., ABC123"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="additionalGuests">
                  Additional Guests (Full Names)
                </Label>
                <Textarea
                  id="additionalGuests"
                  value={additionalGuests}
                  onChange={(e) => setAdditionalGuests(e.target.value)}
                  placeholder="Enter names of additional guests, one per line"
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Step 2: Stay Details */}
          {step === "stay" && (
            <div className="space-y-4">
              <h3 className="font-semibold text-navy">Stay Details</h3>

              {/* Dates First */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="checkIn">Check-in Date *</Label>
                  <Input
                    id="checkIn"
                    type="date"
                    value={checkIn}
                    onChange={(e) => {
                      const newCheckIn = e.target.value;
                      setCheckIn(newCheckIn);
                      setRoomId(""); // Clear room when dates change

                      // Auto-adjust checkout if it's on or before the new check-in
                      if (newCheckIn && checkOut && newCheckIn >= checkOut) {
                        const nextDay = format(
                          addDays(parseISO(newCheckIn), 1),
                          "yyyy-MM-dd",
                        );
                        setCheckOut(nextDay);
                      }
                    }}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkInTime">Time</Label>
                  <Input
                    id="checkInTime"
                    type="time"
                    value={checkInTime}
                    onChange={(e) => setCheckInTime(e.target.value)}
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
                    onChange={(e) => {
                      setCheckOut(e.target.value);
                      setRoomId(""); // Clear room when dates change
                    }}
                    min={checkIn}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkOutTime">Time</Label>
                  <Input
                    id="checkOutTime"
                    type="time"
                    value={checkOutTime}
                    onChange={(e) => setCheckOutTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Room Selection */}
              <div className="space-y-2">
                <Label htmlFor="room">Room *</Label>
                <Select
                  value={roomId}
                  onValueChange={setRoomId}
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
                        Room {room.roomNumber} -{" "}
                        {room.description || "Standard Room"} ($
                        {typeof room.pricePerNight === "string"
                          ? parseFloat(room.pricePerNight).toFixed(0)
                          : room.pricePerNight.toFixed(0)}
                        /night)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availableRooms.length === 0 &&
                  !isLoadingRooms &&
                  checkIn &&
                  checkOut && (
                    <p className="text-sm text-amber-600">
                      All rooms are booked for the selected dates. Please choose
                      different dates.
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
                  <Input
                    value={selectedRoom ? `$${pricePerNight}/night` : "-"}
                    disabled
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bondDeposit">
                  Bond/Deposit (if applicable)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    $
                  </span>
                  <Input
                    id="bondDeposit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={bondDeposit}
                    onChange={(e) => setBondDeposit(e.target.value)}
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
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special requests, arrival info, etc."
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Step 3: Summary */}
          {step === "summary" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-navy">Booking Summary</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generatePDF}
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
                  <span>{guestName}</span>
                  {guestDateOfBirth && (
                    <>
                      <span className="text-gray-500">Date of Birth:</span>
                      <span>{formatDisplayDate(guestDateOfBirth)}</span>
                    </>
                  )}
                  {guestAddress && (
                    <>
                      <span className="text-gray-500">Address:</span>
                      <span>{guestAddress}</span>
                    </>
                  )}
                  {guestPhone && (
                    <>
                      <span className="text-gray-500">Mobile:</span>
                      <span>{guestPhone}</span>
                    </>
                  )}
                  <span className="text-gray-500">Email:</span>
                  <span>{guestEmail}</span>
                  {vehicleRego && (
                    <>
                      <span className="text-gray-500">Vehicle:</span>
                      <span>{vehicleRego}</span>
                    </>
                  )}
                  {additionalGuests && (
                    <>
                      <span className="text-gray-500">Additional Guests:</span>
                      <span className="whitespace-pre-line">
                        {additionalGuests}
                      </span>
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
                    Room {selectedRoom?.roomNumber} -{" "}
                    {selectedRoom?.description || "Standard"}
                  </span>
                  <span className="text-gray-500">Check-in:</span>
                  <span>
                    {formatDisplayDate(checkIn)} at{" "}
                    {formatDisplayTime(checkInTime)}
                  </span>
                  <span className="text-gray-500">Check-out:</span>
                  <span>
                    {formatDisplayDate(checkOut)} at{" "}
                    {formatDisplayTime(checkOutTime)}
                  </span>
                  <span className="text-gray-500">Duration:</span>
                  <span>
                    {nights} night{nights !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Price Summary */}
              <div className="bg-cream/50 p-4 rounded-lg space-y-2">
                <h4 className="font-medium text-navy text-sm">
                  Payment Summary
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      Room {selectedRoom?.roomNumber} × {nights} night
                      {nights !== 1 ? "s" : ""} @ ${pricePerNight}/night
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

              {notes && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-navy text-sm mb-1">Notes</h4>
                  <p className="text-sm text-gray-600">{notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 border-t pt-4 mt-2">
          {step !== "guest" && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(step === "summary" ? "stay" : "guest")}
              disabled={isLoading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}

          {step === "guest" && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          )}

          {step === "guest" && (
            <Button
              type="button"
              onClick={() => setStep("stay")}
              disabled={!canProceedToStay}
              className="bg-navy hover:bg-navy-dark text-cream"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          {step === "stay" && (
            <Button
              type="button"
              onClick={() => setStep("summary")}
              disabled={!canProceedToSummary}
              className="bg-navy hover:bg-navy-dark text-cream"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          {step === "summary" && (
            <Button
              type="button"
              onClick={handleSubmit}
              className="bg-navy hover:bg-navy-dark text-cream"
              disabled={isLoading}
            >
              {isLoading ? "Creating..." : "Create Booking"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
