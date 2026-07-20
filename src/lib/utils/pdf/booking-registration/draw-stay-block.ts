import { jsPDF } from "jspdf";
import { differenceInDays } from "date-fns";
import {
  PAGE_MARGIN,
  LABEL_OFFSET,
  formatDisplayDate,
  formatDisplayTime,
} from "./pdf-helpers";
import type { BookingPDFData } from "./pdf-types";

/**
 * Draw the STAY DETAILS block (room, dates/times, nights, rate, bond).
 * Returns the new `y` cursor position.
 */
export function drawStayBlock(
  doc: jsPDF,
  y: number,
  data: BookingPDFData
): number {
  const nights = differenceInDays(
    new Date(data.checkOut),
    new Date(data.checkIn)
  );
  const bondDeposit = data.bondDeposit
    ? typeof data.bondDeposit === "string"
      ? data.bondDeposit
      : data.bondDeposit.toString()
    : "0";

  // Section title
  y += 3;
  doc.setFontSize(12);
  doc.setFont("times", "bold");
  doc.text("STAY DETAILS", PAGE_MARGIN, y);
  y += 7;

  doc.setFontSize(11);

  // Room Number
  doc.setFont("times", "normal");
  const roomLabel = "Room Number:";
  doc.text(roomLabel, PAGE_MARGIN, y);
  const roomX = PAGE_MARGIN + doc.getTextWidth(roomLabel) + LABEL_OFFSET;
  doc.line(roomX, y + 1, roomX + 20, y + 1);
  doc.setFont("times", "bold");
  if (data.roomNumber) doc.text(data.roomNumber, roomX + 2, y);
  y += 7;

  // Check-in Date and Time
  doc.setFont("times", "normal");
  const checkInLabel = "Check-in Date:";
  doc.text(checkInLabel, PAGE_MARGIN, y);
  const checkInX = PAGE_MARGIN + doc.getTextWidth(checkInLabel) + LABEL_OFFSET;
  doc.line(checkInX, y + 1, checkInX + 26, y + 1);
  doc.setFont("times", "bold");
  if (data.checkIn) doc.text(formatDisplayDate(data.checkIn), checkInX + 2, y);
  doc.setFont("times", "normal");
  const timeLabel = "Time:";
  doc.text(timeLabel, 100, y);
  const timeX = 100 + doc.getTextWidth(timeLabel) + LABEL_OFFSET;
  doc.line(timeX, y + 1, timeX + 22, y + 1);
  doc.setFont("times", "bold");
  if (data.checkInTime)
    doc.text(formatDisplayTime(data.checkInTime), timeX + 2, y);
  y += 7;

  // Check-out Date and Time
  doc.setFont("times", "normal");
  const checkOutLabel = "Check-out Date:";
  doc.text(checkOutLabel, PAGE_MARGIN, y);
  const checkOutX = PAGE_MARGIN + doc.getTextWidth(checkOutLabel) + LABEL_OFFSET;
  doc.line(checkOutX, y + 1, checkOutX + 26, y + 1);
  doc.setFont("times", "bold");
  if (data.checkOut)
    doc.text(formatDisplayDate(data.checkOut), checkOutX + 2, y);
  doc.setFont("times", "normal");
  doc.text(timeLabel, 100, y);
  doc.line(timeX, y + 1, timeX + 22, y + 1);
  doc.setFont("times", "bold");
  if (data.checkOutTime)
    doc.text(formatDisplayTime(data.checkOutTime), timeX + 2, y);
  y += 7;

  // Number of Nights and Room Rate
  doc.setFont("times", "normal");
  const nightsLabel = "Number of Nights:";
  doc.text(nightsLabel, PAGE_MARGIN, y);
  const nightsX = PAGE_MARGIN + doc.getTextWidth(nightsLabel) + LABEL_OFFSET;
  doc.line(nightsX, y + 1, nightsX + 12, y + 1);
  doc.setFont("times", "bold");
  doc.text(nights.toString(), nightsX + 2, y);
  doc.setFont("times", "normal");
  const rateLabel = "Room Rate: $";
  doc.text(rateLabel, 85, y);
  const rateX = 85 + doc.getTextWidth(rateLabel) + LABEL_OFFSET;
  doc.line(rateX, y + 1, rateX + 14, y + 1);
  doc.setFont("times", "bold");
  doc.text(data.pricePerNight.toFixed(0), rateX + 2, y);
  doc.setFont("times", "normal");
  doc.text("per night", rateX + 16, y);
  y += 7;

  // Bond/Deposit
  doc.setFont("times", "normal");
  const bondLabel = "Bond/Deposit (if applicable): $";
  doc.text(bondLabel, PAGE_MARGIN, y);
  const bondX = PAGE_MARGIN + doc.getTextWidth(bondLabel) + LABEL_OFFSET;
  doc.line(bondX, y + 1, bondX + 16, y + 1);
  doc.setFont("times", "bold");
  doc.text(bondDeposit, bondX + 2, y);
  y += 9;

  return y;
}
