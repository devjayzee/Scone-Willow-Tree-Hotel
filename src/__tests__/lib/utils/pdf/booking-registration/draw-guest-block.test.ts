import { describe, it, expect, vi } from "vitest";
import { jsPDF } from "jspdf";
import { drawGuestBlock } from "@/lib/utils/pdf/booking-registration/draw-guest-block";
import type { BookingPDFData } from "@/lib/utils/pdf/booking-registration/pdf-types";

const fullData: BookingPDFData = {
  guestName: "Jane Doe",
  guestDateOfBirth: "1990-01-15",
  guestAddress: "123 Main St",
  guestEmail: "jane@example.com",
  guestPhone: "0412345678",
  vehicleRego: "ABC123",
  additionalGuests: "John Smith\nAlice Jones\n\n",
  checkIn: "2026-05-01",
  checkOut: "2026-05-03",
  roomNumber: "101",
  pricePerNight: 150,
};

const minimalData: BookingPDFData = {
  guestName: "Jane Doe",
  guestPhone: "0412345678",
  checkIn: "2026-05-01",
  checkOut: "2026-05-03",
  roomNumber: "101",
  pricePerNight: 150,
};

describe("drawGuestBlock", () => {
  it("returns the same y cursor regardless of which optional fields are present", () => {
    expect(drawGuestBlock(new jsPDF(), 50, fullData)).toBe(104);
    expect(drawGuestBlock(new jsPDF(), 50, minimalData)).toBe(104);
  });

  it("draws every provided value", () => {
    const doc = new jsPDF();
    const textSpy = vi.spyOn(doc, "text");

    drawGuestBlock(doc, 50, fullData);

    const drawn = textSpy.mock.calls.map((call) => call[0]);
    expect(drawn).toContain("Jane Doe");
    expect(drawn).toContain("15/01/1990");
    expect(drawn).toContain("123 Main St");
    expect(drawn).toContain("0412345678");
    expect(drawn).toContain("jane@example.com");
    expect(drawn).toContain("ABC123");
    // Multi-line additional guests are filtered of blanks and joined with ", ".
    expect(drawn).toContain("John Smith, Alice Jones");
  });

  it("does not draw optional values that are absent", () => {
    const doc = new jsPDF();
    const textSpy = vi.spyOn(doc, "text");

    drawGuestBlock(doc, 50, minimalData);

    const drawn = textSpy.mock.calls.map((call) => call[0]);
    expect(drawn).not.toContain("123 Main St");
    expect(drawn).not.toContain("jane@example.com");
    expect(drawn).not.toContain("ABC123");
    // Labels still always render.
    expect(drawn).toContain("Home Address:");
    expect(drawn).toContain("Email:");
  });
});
