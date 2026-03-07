import { jsPDF } from "jspdf";
import { format, parseISO, differenceInDays } from "date-fns";
import type { Booking } from "@/types/booking";

/**
 * Data structure for PDF generation
 * Supports both existing bookings and draft booking data
 */
export interface BookingPDFData {
  guestName: string;
  guestDateOfBirth?: string | null;
  guestAddress?: string | null;
  guestEmail?: string | null;
  guestPhone: string;
  vehicleRego?: string | null;
  additionalGuests?: string | null;
  checkIn: string;
  checkInTime?: string | null;
  checkOut: string;
  checkOutTime?: string | null;
  bondDeposit?: string | number | null;
  roomNumber: string;
  pricePerNight: number;
}

/**
 * Format a date string for display in the PDF
 */
function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    // Handle both ISO strings and date-only strings
    const date = dateStr.includes("T") ? parseISO(dateStr) : new Date(dateStr);
    return format(date, "dd/MM/yyyy");
  } catch {
    return dateStr;
  }
}

/**
 * Format a time string for display (HH:mm to h:mm AM/PM)
 */
function formatDisplayTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "";
  const [hours, minutes] = timeStr.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

/**
 * Convert a Booking object to BookingPDFData
 */
export function bookingToPDFData(booking: Booking): BookingPDFData {
  const pricePerNight =
    typeof booking.room.pricePerNight === "string"
      ? parseFloat(booking.room.pricePerNight)
      : booking.room.pricePerNight;

  return {
    guestName: booking.guestName,
    guestDateOfBirth: booking.guestDateOfBirth,
    guestAddress: booking.guestAddress,
    guestEmail: booking.guestEmail,
    guestPhone: booking.guestPhone,
    vehicleRego: booking.vehicleRego,
    additionalGuests: booking.additionalGuests,
    checkIn: booking.checkIn,
    checkInTime: booking.checkInTime,
    checkOut: booking.checkOut,
    checkOutTime: booking.checkOutTime,
    bondDeposit: booking.bondDeposit,
    roomNumber: booking.room.roomNumber,
    pricePerNight,
  };
}

/**
 * Generate a guest registration PDF document
 * @param data - Booking data for the PDF
 * @returns jsPDF document instance
 */
export function generateBookingRegistrationPDF(data: BookingPDFData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 25;
  let y = 15;
  const labelOffset = 2;

  // Calculate derived values
  const nights = differenceInDays(new Date(data.checkOut), new Date(data.checkIn));
  const bondDeposit = data.bondDeposit
    ? typeof data.bondDeposit === "string"
      ? data.bondDeposit
      : data.bondDeposit.toString()
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
  doc.text("136 Kelly St, Scone NSW 2337", pageWidth / 2, y, {
    align: "center",
  });
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
  if (data.guestName) doc.text(data.guestName, fullNameX + 2, y);
  y += 7;

  // Date of Birth
  doc.setFont("times", "normal");
  const dobLabel = "Date of Birth:";
  doc.text(dobLabel, margin, y);
  const dobX = margin + doc.getTextWidth(dobLabel) + labelOffset;
  doc.line(dobX, y + 1, dobX + 28, y + 1);
  doc.setFont("times", "bold");
  if (data.guestDateOfBirth) {
    doc.text(formatDisplayDate(data.guestDateOfBirth), dobX + 2, y);
  }
  y += 7;

  // Home Address
  doc.setFont("times", "normal");
  const addressLabel = "Home Address:";
  doc.text(addressLabel, margin, y);
  const addressX = margin + doc.getTextWidth(addressLabel) + labelOffset;
  doc.line(addressX, y + 1, pageWidth - margin, y + 1);
  doc.setFont("times", "bold");
  if (data.guestAddress) doc.text(data.guestAddress, addressX + 2, y);
  y += 7;

  // Mobile Number and Email
  doc.setFont("times", "normal");
  const mobileLabel = "Mobile Number:";
  doc.text(mobileLabel, margin, y);
  const mobileX = margin + doc.getTextWidth(mobileLabel) + labelOffset;
  doc.line(mobileX, y + 1, 95, y + 1);
  doc.setFont("times", "bold");
  if (data.guestPhone) doc.text(data.guestPhone, mobileX + 2, y);
  doc.setFont("times", "normal");
  const emailLabel = "Email:";
  doc.text(emailLabel, 100, y);
  const emailX = 100 + doc.getTextWidth(emailLabel) + labelOffset;
  doc.line(emailX, y + 1, pageWidth - margin, y + 1);
  doc.setFont("times", "bold");
  if (data.guestEmail) doc.text(data.guestEmail, emailX + 2, y);
  y += 7;

  // Vehicle Registration
  doc.setFont("times", "normal");
  const vehicleLabel = "Vehicle Registration:";
  doc.text(vehicleLabel, margin, y);
  const vehicleX = margin + doc.getTextWidth(vehicleLabel) + labelOffset;
  doc.line(vehicleX, y + 1, 100, y + 1);
  doc.setFont("times", "bold");
  if (data.vehicleRego) doc.text(data.vehicleRego, vehicleX + 2, y);
  y += 7;

  // Additional Guests
  doc.setFont("times", "normal");
  const guestsLabel = "Additional Guests (Full Names):";
  doc.text(guestsLabel, margin, y);
  const guestsX = margin + doc.getTextWidth(guestsLabel) + labelOffset;
  doc.line(guestsX, y + 1, pageWidth - margin, y + 1);
  doc.setFont("times", "bold");
  if (data.additionalGuests) {
    const guestsList = data.additionalGuests
      .split("\n")
      .filter((g) => g.trim())
      .join(", ");
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
  if (data.roomNumber) doc.text(data.roomNumber, roomX + 2, y);
  y += 7;

  // Check-in Date and Time
  doc.setFont("times", "normal");
  const checkInLabel = "Check-in Date:";
  doc.text(checkInLabel, margin, y);
  const checkInX = margin + doc.getTextWidth(checkInLabel) + labelOffset;
  doc.line(checkInX, y + 1, checkInX + 26, y + 1);
  doc.setFont("times", "bold");
  if (data.checkIn) doc.text(formatDisplayDate(data.checkIn), checkInX + 2, y);
  doc.setFont("times", "normal");
  const timeLabel1 = "Time:";
  doc.text(timeLabel1, 100, y);
  const timeX1 = 100 + doc.getTextWidth(timeLabel1) + labelOffset;
  doc.line(timeX1, y + 1, timeX1 + 22, y + 1);
  doc.setFont("times", "bold");
  if (data.checkInTime)
    doc.text(formatDisplayTime(data.checkInTime), timeX1 + 2, y);
  y += 7;

  // Check-out Date and Time
  doc.setFont("times", "normal");
  const checkOutLabel = "Check-out Date:";
  doc.text(checkOutLabel, margin, y);
  const checkOutX = margin + doc.getTextWidth(checkOutLabel) + labelOffset;
  doc.line(checkOutX, y + 1, checkOutX + 26, y + 1);
  doc.setFont("times", "bold");
  if (data.checkOut)
    doc.text(formatDisplayDate(data.checkOut), checkOutX + 2, y);
  doc.setFont("times", "normal");
  doc.text(timeLabel1, 100, y);
  doc.line(timeX1, y + 1, timeX1 + 22, y + 1);
  doc.setFont("times", "bold");
  if (data.checkOutTime)
    doc.text(formatDisplayTime(data.checkOutTime), timeX1 + 2, y);
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
  doc.text(data.pricePerNight.toFixed(0), rateX + 2, y);
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
  const paymentText =
    "I authorise Willow Tree Inn to charge accommodation fees and any additional charges (damages, late checkout, cleaning fees, lost keys) to my nominated payment method.";
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

  return doc;
}

/**
 * Generate and save a guest registration PDF for a booking
 * @param booking - The booking to generate PDF for
 */
export function downloadBookingPDF(booking: Booking): void {
  const pdfData = bookingToPDFData(booking);
  const doc = generateBookingRegistrationPDF(pdfData);
  const filename = `guest-registration-${booking.guestName
    .replace(/\s+/g, "-")
    .toLowerCase()}.pdf`;
  doc.save(filename);
}

/**
 * Generate and save a guest registration PDF from draft data
 * @param data - The draft booking data
 * @param guestName - Guest name for the filename
 */
export function downloadDraftBookingPDF(
  data: BookingPDFData,
  guestName: string
): void {
  const doc = generateBookingRegistrationPDF(data);
  const filename = `guest-registration-${guestName
    .replace(/\s+/g, "-")
    .toLowerCase()}.pdf`;
  doc.save(filename);
}
