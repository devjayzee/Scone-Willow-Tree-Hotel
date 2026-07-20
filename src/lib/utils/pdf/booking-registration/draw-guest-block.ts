import { jsPDF } from "jspdf";
import { PAGE_MARGIN, LABEL_OFFSET, formatDisplayDate } from "./pdf-helpers";
import type { BookingPDFData } from "./pdf-types";

/**
 * Draw the GUEST DETAILS block (name, DOB, address, phone, email, vehicle,
 * additional guests). Returns the new `y` cursor position.
 */
export function drawGuestBlock(
  doc: jsPDF,
  y: number,
  data: BookingPDFData
): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Section title
  doc.setFontSize(12);
  doc.setFont("times", "bold");
  doc.text("GUEST DETAILS", PAGE_MARGIN, y);
  y += 7;

  doc.setFontSize(11);

  // Full Name
  doc.setFont("times", "normal");
  const fullNameLabel = "Full Name:";
  doc.text(fullNameLabel, PAGE_MARGIN, y);
  const fullNameX = PAGE_MARGIN + doc.getTextWidth(fullNameLabel) + LABEL_OFFSET;
  doc.line(fullNameX, y + 1, pageWidth - PAGE_MARGIN, y + 1);
  doc.setFont("times", "bold");
  if (data.guestName) doc.text(data.guestName, fullNameX + 2, y);
  y += 7;

  // Date of Birth
  doc.setFont("times", "normal");
  const dobLabel = "Date of Birth:";
  doc.text(dobLabel, PAGE_MARGIN, y);
  const dobX = PAGE_MARGIN + doc.getTextWidth(dobLabel) + LABEL_OFFSET;
  doc.line(dobX, y + 1, dobX + 28, y + 1);
  doc.setFont("times", "bold");
  if (data.guestDateOfBirth) {
    doc.text(formatDisplayDate(data.guestDateOfBirth), dobX + 2, y);
  }
  y += 7;

  // Home Address
  doc.setFont("times", "normal");
  const addressLabel = "Home Address:";
  doc.text(addressLabel, PAGE_MARGIN, y);
  const addressX = PAGE_MARGIN + doc.getTextWidth(addressLabel) + LABEL_OFFSET;
  doc.line(addressX, y + 1, pageWidth - PAGE_MARGIN, y + 1);
  doc.setFont("times", "bold");
  if (data.guestAddress) doc.text(data.guestAddress, addressX + 2, y);
  y += 7;

  // Mobile Number and Email
  doc.setFont("times", "normal");
  const mobileLabel = "Mobile Number:";
  doc.text(mobileLabel, PAGE_MARGIN, y);
  const mobileX = PAGE_MARGIN + doc.getTextWidth(mobileLabel) + LABEL_OFFSET;
  doc.line(mobileX, y + 1, 95, y + 1);
  doc.setFont("times", "bold");
  if (data.guestPhone) doc.text(data.guestPhone, mobileX + 2, y);
  doc.setFont("times", "normal");
  const emailLabel = "Email:";
  doc.text(emailLabel, 100, y);
  const emailX = 100 + doc.getTextWidth(emailLabel) + LABEL_OFFSET;
  doc.line(emailX, y + 1, pageWidth - PAGE_MARGIN, y + 1);
  doc.setFont("times", "bold");
  if (data.guestEmail) doc.text(data.guestEmail, emailX + 2, y);
  y += 7;

  // Vehicle Registration
  doc.setFont("times", "normal");
  const vehicleLabel = "Vehicle Registration:";
  doc.text(vehicleLabel, PAGE_MARGIN, y);
  const vehicleX = PAGE_MARGIN + doc.getTextWidth(vehicleLabel) + LABEL_OFFSET;
  doc.line(vehicleX, y + 1, 100, y + 1);
  doc.setFont("times", "bold");
  if (data.vehicleRego) doc.text(data.vehicleRego, vehicleX + 2, y);
  y += 7;

  // Additional Guests
  doc.setFont("times", "normal");
  const guestsLabel = "Additional Guests (Full Names):";
  doc.text(guestsLabel, PAGE_MARGIN, y);
  const guestsX = PAGE_MARGIN + doc.getTextWidth(guestsLabel) + LABEL_OFFSET;
  doc.line(guestsX, y + 1, pageWidth - PAGE_MARGIN, y + 1);
  doc.setFont("times", "bold");
  if (data.additionalGuests) {
    const guestsList = data.additionalGuests
      .split("\n")
      .filter((g) => g.trim())
      .join(", ");
    doc.text(guestsList, guestsX + 2, y);
  }
  y += 12;

  return y;
}
