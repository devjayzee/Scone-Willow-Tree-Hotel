"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookingTable } from "@/components/booking/booking-table";
import { BookingDialog } from "@/components/booking/booking-dialog";
import { BookingDetailsDialog } from "@/components/booking/booking-details-dialog";
import { DeleteBookingDialog } from "@/components/booking/delete-booking-dialog";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { format, parseISO, differenceInDays } from "date-fns";
import type { RoomSummary } from "@/types/room";

interface Booking {
  id: string;
  bookingRef: string;
  guestName: string;
  guestDateOfBirth?: string | null;
  guestAddress?: string | null;
  guestEmail: string;
  guestPhone?: string | null;
  vehicleRego?: string | null;
  additionalGuests?: string | null;
  checkIn: string;
  checkInTime?: string | null;
  checkOut: string;
  checkOutTime?: string | null;
  bondDeposit?: string | number | null;
  notes?: string | null;
  createdAt: string;
  room: {
    roomNumber: string;
    pricePerNight: string | number;
  };
  createdBy?: {
    firstName: string;
    lastName: string;
  };
}

function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="h-8 w-32 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 w-48 bg-gray-200 rounded"></div>
        </div>
        <div className="h-10 w-32 bg-gray-200 rounded"></div>
      </div>

      {/* Search Skeleton */}
      <div className="h-10 w-80 bg-gray-200 rounded"></div>

      {/* Table Skeleton */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50/50 text-sm font-medium text-gray-500">
              <th className="text-left px-6 py-3">Booking Ref</th>
              <th className="text-left px-6 py-3">Guest</th>
              <th className="text-left px-6 py-3">Room</th>
              <th className="text-left px-6 py-3">Check In</th>
              <th className="text-left px-6 py-3">Check Out</th>
              <th className="text-right px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-4">
                  <div className="h-4 w-28 bg-gray-200 rounded"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-gray-200 rounded"></div>
                    <div className="h-3 w-40 bg-gray-200 rounded"></div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 w-16 bg-gray-200 rounded"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 w-24 bg-gray-200 rounded"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 w-24 bg-gray-200 rounded"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-1">
                    <div className="h-8 w-8 bg-gray-200 rounded"></div>
                    <div className="h-8 w-8 bg-gray-200 rounded"></div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-6 py-3 border-t bg-gray-50/30">
          <div className="h-4 w-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Dialog states
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchBookings = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      const response = await fetch("/api/bookings");
      if (!response.ok) throw new Error("Failed to fetch bookings");
      const data = await response.json();
      setBookings(data);
      setError("");
    } catch {
      setError("Failed to load bookings");
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  const fetchRooms = useCallback(async () => {
    try {
      const response = await fetch("/api/rooms");
      if (!response.ok) throw new Error("Failed to fetch rooms");
      const data = await response.json();
      setRooms(data);
    } catch {
      console.error("Failed to fetch rooms");
    }
  }, []);

  useEffect(() => {
    fetchBookings();
    fetchRooms();
  }, [fetchBookings, fetchRooms]);

  // Delay for skeleton loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const handleCreateBooking = async (data: {
    roomId: string;
    guestName: string;
    guestDateOfBirth?: string;
    guestAddress?: string;
    guestEmail: string;
    guestPhone?: string;
    vehicleRego?: string;
    additionalGuests?: string;
    checkIn: string;
    checkInTime?: string;
    checkOut: string;
    checkOutTime?: string;
    bondDeposit?: number;
    notes?: string;
  }) => {
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to create booking");
    }

    toast.success("Booking created successfully");
    await fetchBookings(false);
  };

  const handleView = (booking: Booking) => {
    setSelectedBooking(booking);
    setDetailsDialogOpen(true);
  };

  const handleDelete = (booking: Booking) => {
    setSelectedBooking(booking);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedBooking) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/bookings/${selectedBooking.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete booking");
      }

      toast.success("Booking deleted successfully");
      setDeleteDialogOpen(false);
      await fetchBookings(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete booking");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadPDF = (booking: Booking) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 25;
    let y = 15;
    const labelOffset = 2;

    const formatDisplayDate = (dateStr: string) => {
      if (!dateStr) return "";
      return format(parseISO(dateStr), "dd/MM/yyyy");
    };

    const formatDisplayTime = (timeStr: string | null | undefined) => {
      if (!timeStr) return "";
      const [hours, minutes] = timeStr.split(":");
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    };

    const pricePerNight = typeof booking.room.pricePerNight === "string"
      ? parseFloat(booking.room.pricePerNight)
      : booking.room.pricePerNight;
    const nights = differenceInDays(new Date(booking.checkOut), new Date(booking.checkIn));
    const bondDeposit = booking.bondDeposit
      ? typeof booking.bondDeposit === "string"
        ? booking.bondDeposit
        : booking.bondDeposit.toString()
      : "0";

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
    doc.text("136 Kelly St, Scone NSW 2337", pageWidth / 2, y, { align: "center" });
    y += 3;
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // GUEST DETAILS
    doc.setFontSize(12);
    doc.setFont("times", "bold");
    doc.text("GUEST DETAILS", margin, y);
    y += 7;

    doc.setFontSize(11);

    // Full Name
    doc.setFont("times", "normal");
    const fullNameLabel = "Full Name:";
    doc.text(fullNameLabel, margin, y);
    const fullNameX = margin + doc.getTextWidth(fullNameLabel) + labelOffset;
    doc.line(fullNameX, y + 1, pageWidth - margin, y + 1);
    doc.setFont("times", "bold");
    doc.text(booking.guestName, fullNameX + 2, y);
    y += 7;

    // Date of Birth
    doc.setFont("times", "normal");
    const dobLabel = "Date of Birth:";
    doc.text(dobLabel, margin, y);
    const dobX = margin + doc.getTextWidth(dobLabel) + labelOffset;
    doc.line(dobX, y + 1, dobX + 28, y + 1);
    doc.setFont("times", "bold");
    if (booking.guestDateOfBirth) {
      doc.text(formatDisplayDate(booking.guestDateOfBirth), dobX + 2, y);
    }
    y += 7;

    // Home Address
    doc.setFont("times", "normal");
    const addressLabel = "Home Address:";
    doc.text(addressLabel, margin, y);
    const addressX = margin + doc.getTextWidth(addressLabel) + labelOffset;
    doc.line(addressX, y + 1, pageWidth - margin, y + 1);
    doc.setFont("times", "bold");
    if (booking.guestAddress) doc.text(booking.guestAddress, addressX + 2, y);
    y += 7;

    // Mobile Number and Email
    doc.setFont("times", "normal");
    const mobileLabel = "Mobile Number:";
    doc.text(mobileLabel, margin, y);
    const mobileX = margin + doc.getTextWidth(mobileLabel) + labelOffset;
    doc.line(mobileX, y + 1, 95, y + 1);
    doc.setFont("times", "bold");
    if (booking.guestPhone) doc.text(booking.guestPhone, mobileX + 2, y);
    doc.setFont("times", "normal");
    const emailLabel = "Email:";
    doc.text(emailLabel, 100, y);
    const emailX = 100 + doc.getTextWidth(emailLabel) + labelOffset;
    doc.line(emailX, y + 1, pageWidth - margin, y + 1);
    doc.setFont("times", "bold");
    doc.text(booking.guestEmail, emailX + 2, y);
    y += 7;

    // Vehicle Registration
    doc.setFont("times", "normal");
    const vehicleLabel = "Vehicle Registration:";
    doc.text(vehicleLabel, margin, y);
    const vehicleX = margin + doc.getTextWidth(vehicleLabel) + labelOffset;
    doc.line(vehicleX, y + 1, 100, y + 1);
    doc.setFont("times", "bold");
    if (booking.vehicleRego) doc.text(booking.vehicleRego, vehicleX + 2, y);
    y += 7;

    // Additional Guests
    doc.setFont("times", "normal");
    const guestsLabel = "Additional Guests (Full Names):";
    doc.text(guestsLabel, margin, y);
    const guestsX = margin + doc.getTextWidth(guestsLabel) + labelOffset;
    doc.line(guestsX, y + 1, pageWidth - margin, y + 1);
    doc.setFont("times", "bold");
    if (booking.additionalGuests) {
      const guestsList = booking.additionalGuests.split("\n").filter(g => g.trim()).join(", ");
      doc.text(guestsList, guestsX + 2, y);
    }
    y += 12;

    // STAY DETAILS
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
    doc.text(booking.room.roomNumber, roomX + 2, y);
    y += 7;

    // Check-in Date and Time
    doc.setFont("times", "normal");
    const checkInLabel = "Check-in Date:";
    doc.text(checkInLabel, margin, y);
    const checkInX = margin + doc.getTextWidth(checkInLabel) + labelOffset;
    doc.line(checkInX, y + 1, checkInX + 26, y + 1);
    doc.setFont("times", "bold");
    doc.text(formatDisplayDate(booking.checkIn), checkInX + 2, y);
    doc.setFont("times", "normal");
    const timeLabel1 = "Time:";
    doc.text(timeLabel1, 100, y);
    const timeX1 = 100 + doc.getTextWidth(timeLabel1) + labelOffset;
    doc.line(timeX1, y + 1, timeX1 + 22, y + 1);
    doc.setFont("times", "bold");
    if (booking.checkInTime) doc.text(formatDisplayTime(booking.checkInTime), timeX1 + 2, y);
    y += 7;

    // Check-out Date and Time
    doc.setFont("times", "normal");
    const checkOutLabel = "Check-out Date:";
    doc.text(checkOutLabel, margin, y);
    const checkOutX = margin + doc.getTextWidth(checkOutLabel) + labelOffset;
    doc.line(checkOutX, y + 1, checkOutX + 26, y + 1);
    doc.setFont("times", "bold");
    doc.text(formatDisplayDate(booking.checkOut), checkOutX + 2, y);
    doc.setFont("times", "normal");
    doc.text(timeLabel1, 100, y);
    doc.line(timeX1, y + 1, timeX1 + 22, y + 1);
    doc.setFont("times", "bold");
    if (booking.checkOutTime) doc.text(formatDisplayTime(booking.checkOutTime), timeX1 + 2, y);
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
    doc.text(bondDeposit, bondX + 2, y);
    y += 9;

    // TERMS & CONDITIONS
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

    // PAYMENT AUTHORISATION
    doc.setFontSize(12);
    doc.setFont("times", "bold");
    doc.text("PAYMENT AUTHORISATION", margin, y);
    y += 6;

    doc.setFontSize(11);
    doc.setFont("times", "normal");
    const paymentText = "I authorise Willow Tree Inn to charge accommodation fees and any additional charges (damages, late checkout, cleaning fees, lost keys) to my nominated payment method.";
    const paymentLines = doc.splitTextToSize(paymentText, pageWidth - margin * 2);
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
    doc.save(`guest-registration-${booking.guestName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
  };

  // Filter bookings
  const filteredBookings = bookings.filter((booking) => {
    return (
      booking.bookingRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.guestEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.room.roomNumber.includes(searchQuery)
    );
  });

  // Show skeleton while loading
  if (!mounted || isLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Bookings</h1>
          <p className="text-muted-foreground">Manage guest reservations</p>
        </div>
        <Button
          onClick={() => setBookingDialogOpen(true)}
          className="bg-navy hover:bg-navy-dark text-cream"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Booking
        </Button>
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search bookings..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="pl-9 bg-white"
        />
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          {error}
        </div>
      )}

      <BookingTable
        bookings={filteredBookings}
        onView={handleView}
        onDelete={handleDelete}
        onDownloadPDF={handleDownloadPDF}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />

      <BookingDialog
        open={bookingDialogOpen}
        onOpenChange={setBookingDialogOpen}
        rooms={rooms}
        onSubmit={handleCreateBooking}
      />

      <BookingDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        booking={selectedBooking}
      />

      <DeleteBookingDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        bookingRef={selectedBooking?.bookingRef || ""}
        guestName={selectedBooking?.guestName || ""}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
      />
    </div>
  );
}
