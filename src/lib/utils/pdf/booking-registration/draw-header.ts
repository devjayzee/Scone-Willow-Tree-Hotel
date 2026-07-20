import { jsPDF } from "jspdf";
import { PAGE_MARGIN } from "./pdf-helpers";

/**
 * Draw the hotel logo (if provided) and the header block.
 * Returns the new `y` cursor position after the header.
 */
export function drawHeader(
  doc: jsPDF,
  y: number,
  logoBase64: string | null | undefined
): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Logo (optional — some renders may fail to fetch it)
  if (logoBase64) {
    const logoWidth = 50;
    const logoHeight = 35;
    const logoX = (pageWidth - logoWidth) / 2;
    doc.addImage(logoBase64, "PNG", logoX, y, logoWidth, logoHeight);
    y += logoHeight + 5;
  }

  // Hotel name (bold, centered)
  doc.setFontSize(14);
  doc.setFont("times", "bold");
  doc.text("SCONE WILLOW TREE HOTEL", pageWidth / 2, y, { align: "center" });
  y += 6;

  // Sub-header + address
  doc.setFontSize(12);
  doc.setFont("times", "normal");
  doc.text("Guest Registration", pageWidth / 2, y, { align: "center" });
  y += 5;
  doc.text("136 Kelly St, Scone NSW 2337", pageWidth / 2, y, {
    align: "center",
  });
  y += 3;
  doc.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);
  y += 8;

  return y;
}
