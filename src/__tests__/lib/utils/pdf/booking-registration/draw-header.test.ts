import { describe, it, expect, vi } from "vitest";
import { jsPDF } from "jspdf";
import { drawHeader } from "@/lib/utils/pdf/booking-registration/draw-header";

// A minimal valid 1x1 transparent PNG, so jsPDF's addImage can actually
// decode it instead of throwing on garbage bytes.
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("drawHeader", () => {
  it("returns the new y cursor without a logo", () => {
    const doc = new jsPDF();
    expect(drawHeader(doc, 15, null)).toBe(37);
  });

  it("returns a larger y cursor when a logo is drawn", () => {
    const doc = new jsPDF();
    expect(drawHeader(doc, 15, TINY_PNG)).toBe(77);
  });

  it("draws the hotel name and address", () => {
    const doc = new jsPDF();
    const textSpy = vi.spyOn(doc, "text");

    drawHeader(doc, 15, null);

    const drawn = textSpy.mock.calls.map((call) => call[0]);
    expect(drawn).toContain("SCONE WILLOW TREE HOTEL");
    expect(drawn).toContain("Guest Registration");
    expect(drawn).toContain("136 Kelly St, Scone NSW 2337");
  });

  it("calls addImage only when a logo is provided", () => {
    const withLogo = new jsPDF();
    const withLogoSpy = vi.spyOn(withLogo, "addImage");
    drawHeader(withLogo, 15, TINY_PNG);
    expect(withLogoSpy).toHaveBeenCalledTimes(1);

    const withoutLogo = new jsPDF();
    const withoutLogoSpy = vi.spyOn(withoutLogo, "addImage");
    drawHeader(withoutLogo, 15, null);
    expect(withoutLogoSpy).not.toHaveBeenCalled();

    const undefinedLogo = new jsPDF();
    const undefinedLogoSpy = vi.spyOn(undefinedLogo, "addImage");
    drawHeader(undefinedLogo, 15, undefined);
    expect(undefinedLogoSpy).not.toHaveBeenCalled();
  });
});
