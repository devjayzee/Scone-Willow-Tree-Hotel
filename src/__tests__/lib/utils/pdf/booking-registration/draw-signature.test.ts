import { describe, it, expect, vi } from "vitest";
import { jsPDF } from "jspdf";
import { drawSignature } from "@/lib/utils/pdf/booking-registration/draw-signature";

describe("drawSignature", () => {
  it("returns the new y cursor", () => {
    const doc = new jsPDF();
    expect(drawSignature(doc, 50)).toBe(83);
  });

  it("draws the authorisation title, paragraph, and label lines", () => {
    const doc = new jsPDF();
    const textSpy = vi.spyOn(doc, "text");
    const lineSpy = vi.spyOn(doc, "line");

    drawSignature(doc, 50);

    const drawn = textSpy.mock.calls
      .map((call) => call[0])
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .join(" ");

    expect(drawn).toContain("PAYMENT AUTHORISATION");
    expect(drawn).toContain("I authorise Willow Tree Inn");
    expect(drawn).toContain("Cardholder Name:");
    expect(drawn).toContain("Signature:");
    expect(drawn).toContain("Date:");

    // Cardholder, signature, and date each get an underline.
    expect(lineSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
