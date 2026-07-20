import { jsPDF } from "jspdf";
import type { Booking } from "@/types/booking";
import { getLogoBase64 } from "./pdf-helpers";
import { drawHeader } from "./draw-header";
import { drawGuestBlock } from "./draw-guest-block";
import { drawStayBlock } from "./draw-stay-block";
import { drawTerms } from "./draw-terms";
import { drawSignature } from "./draw-signature";
import { bookingToPDFData, type BookingPDFData } from "./pdf-types";

// Re-export types + helpers consumers depend on.
export { bookingToPDFData };
export type { BookingPDFData };

/**
 * Generate a guest registration PDF document by composing the section
 * drawers. Each drawer takes the current `y` cursor and returns the new
 * one so sections stack correctly.
 */
export function generateBookingRegistrationPDF(
  data: BookingPDFData,
  logoBase64?: string | null
): jsPDF {
  const doc = new jsPDF();
  let y = 15;

  doc.setTextColor(0, 0, 0);
  y = drawHeader(doc, y, logoBase64);
  y = drawGuestBlock(doc, y, data);
  y = drawStayBlock(doc, y, data);
  y = drawTerms(doc, y);
  drawSignature(doc, y);

  return doc;
}

/**
 * Generate and save a guest registration PDF for a persisted booking.
 */
export async function downloadBookingPDF(booking: Booking): Promise<void> {
  const pdfData = bookingToPDFData(booking);
  const logoBase64 = await getLogoBase64();
  const doc = generateBookingRegistrationPDF(pdfData, logoBase64);
  const filename = `guest-registration-${booking.guestName
    .replace(/\s+/g, "-")
    .toLowerCase()}.pdf`;
  doc.save(filename);
}

/**
 * Generate and save a guest registration PDF from unsaved draft data
 * (used by the booking form's "download draft" flow).
 */
export async function downloadDraftBookingPDF(
  data: BookingPDFData,
  guestName: string
): Promise<void> {
  const logoBase64 = await getLogoBase64();
  const doc = generateBookingRegistrationPDF(data, logoBase64);
  const filename = `guest-registration-${guestName
    .replace(/\s+/g, "-")
    .toLowerCase()}.pdf`;
  doc.save(filename);
}
