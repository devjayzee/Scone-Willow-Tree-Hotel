import { describe, it, expect, vi } from "vitest";
import { jsPDF } from "jspdf";
import { drawTerms } from "@/lib/utils/pdf/booking-registration/draw-terms";

describe("drawTerms", () => {
  it("returns the new y cursor", () => {
    const doc = new jsPDF();
    expect(drawTerms(doc, 50)).toBe(122);
  });

  it("draws the section title and every term", () => {
    const doc = new jsPDF();
    const textSpy = vi.spyOn(doc, "text");

    drawTerms(doc, 50);

    // splitTextToSize wraps each term into one or more lines, so match
    // on distinctive substrings rather than the exact (possibly-wrapped)
    // text passed to doc.text.
    const drawn = textSpy.mock.calls
      .map((call) => call[0])
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .join(" ");

    expect(drawn).toContain("TERMS & CONDITIONS");
    expect(drawn).toContain("NON-SMOKING");
    expect(drawn).toContain("Check-in time is from 3:00 PM");
    expect(drawn).toContain("registered guest");
  });
});
