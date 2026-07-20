import { jsPDF } from "jspdf";
import { PAGE_MARGIN } from "./pdf-helpers";

const TERMS = [
  "1.  Check-in time is from 3:00 PM. Check-out time is strictly by 10:00 AM. Late check-out fees may apply.",
  "2.  This is a STRICTLY NON-SMOKING facility.",
  "3.  Only registered guests are permitted to stay overnight.",
  "4.  Guests must keep noise to a minimum after 10:00 PM to respect other guests.",
  "5.  Any damage, loss, or excessive cleaning required will be charged to the registered guest.",
  "6.  Management reserves the right to refuse service or evict guests breaching hotel policy without refund.",
  "7.  The hotel is not responsible for loss or damage to personal belongings unless caused by proven negligence.",
];

/**
 * Draw the TERMS & CONDITIONS block. Terms wrap to the page width via
 * jsPDF's splitTextToSize.
 */
export function drawTerms(doc: jsPDF, y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  y += 3;
  doc.setFontSize(12);
  doc.setFont("times", "bold");
  doc.text("TERMS & CONDITIONS", PAGE_MARGIN, y);
  y += 6;

  doc.setFontSize(11);
  doc.setFont("times", "normal");

  TERMS.forEach((term) => {
    const lines = doc.splitTextToSize(term, pageWidth - PAGE_MARGIN * 2);
    doc.text(lines, PAGE_MARGIN, y);
    y += lines.length * 5 + 1;
  });
  y += 6;

  return y;
}
