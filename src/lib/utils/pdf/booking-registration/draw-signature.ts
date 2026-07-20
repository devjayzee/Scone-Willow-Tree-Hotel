import { jsPDF } from "jspdf";
import { PAGE_MARGIN, LABEL_OFFSET } from "./pdf-helpers";

/**
 * Draw the PAYMENT AUTHORISATION block: authorisation text, cardholder
 * name line, signature line, date line.
 */
export function drawSignature(doc: jsPDF, y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(12);
  doc.setFont("times", "bold");
  doc.text("PAYMENT AUTHORISATION", PAGE_MARGIN, y);
  y += 6;

  doc.setFontSize(11);
  doc.setFont("times", "normal");
  const paymentText =
    "I authorise Willow Tree Inn to charge accommodation fees and any additional charges (damages, late checkout, cleaning fees, lost keys) to my nominated payment method.";
  const paymentLines = doc.splitTextToSize(paymentText, pageWidth - PAGE_MARGIN * 2);
  doc.text(paymentLines, PAGE_MARGIN, y);
  y += paymentLines.length * 5 + 7;

  // Cardholder Name
  doc.setFont("times", "normal");
  const cardLabel = "Cardholder Name:";
  doc.text(cardLabel, PAGE_MARGIN, y);
  const cardX = PAGE_MARGIN + doc.getTextWidth(cardLabel) + LABEL_OFFSET;
  doc.line(cardX, y + 1, pageWidth - PAGE_MARGIN, y + 1);
  y += 10;

  // Signature and Date
  const sigLabel = "Signature:";
  doc.text(sigLabel, PAGE_MARGIN, y);
  const sigX = PAGE_MARGIN + doc.getTextWidth(sigLabel) + LABEL_OFFSET;
  doc.line(sigX, y + 1, 100, y + 1);
  const dateLabel = "Date:";
  doc.text(dateLabel, 110, y);
  const dateX = 110 + doc.getTextWidth(dateLabel) + LABEL_OFFSET;
  doc.line(dateX, y + 1, pageWidth - PAGE_MARGIN, y + 1);

  return y;
}
