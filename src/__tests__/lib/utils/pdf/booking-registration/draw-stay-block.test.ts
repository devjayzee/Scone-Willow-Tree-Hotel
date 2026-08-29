import { describe, it, expect, vi } from "vitest";
import { jsPDF } from "jspdf";
import { drawStayBlock } from "@/lib/utils/pdf/booking-registration/draw-stay-block";
import type { BookingPDFData } from "@/lib/utils/pdf/booking-registration/pdf-types";

const fullData: BookingPDFData = {
  guestName: "Jane Doe",
  guestPhone: "0412345678",
  checkIn: "2026-05-01",
  checkInTime: "14:00",
  checkOut: "2026-05-03",
  checkOutTime: "10:00",
  bondDeposit: 200,
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

describe("drawStayBlock", () => {
  it("returns the same y cursor regardless of which optional fields are present", () => {
    expect(drawStayBlock(new jsPDF(), 50, fullData)).toBe(97);
    expect(drawStayBlock(new jsPDF(), 50, minimalData)).toBe(97);
  });

  it("draws room, formatted dates/times, nights, rate, and bond", () => {
    const doc = new jsPDF();
    const textSpy = vi.spyOn(doc, "text");

    drawStayBlock(doc, 50, fullData);

    const drawn = textSpy.mock.calls.map((call) => call[0]);
    expect(drawn).toContain("101");
    expect(drawn).toContain("01/05/2026");
    expect(drawn).toContain("2:00 PM");
    expect(drawn).toContain("03/05/2026");
    expect(drawn).toContain("10:00 AM");
    expect(drawn).toContain("2"); // 2 nights between May 1 and May 3
    expect(drawn).toContain("150"); // pricePerNight.toFixed(0)
    expect(drawn).toContain("200"); // bondDeposit
  });

  it("defaults bond deposit to '0' when absent", () => {
    const doc = new jsPDF();
    const textSpy = vi.spyOn(doc, "text");

    drawStayBlock(doc, 50, minimalData);

    const drawn = textSpy.mock.calls.map((call) => call[0]);
    expect(drawn).toContain("0");
  });

  it("renders a string bondDeposit as-is", () => {
    const doc = new jsPDF();
    const textSpy = vi.spyOn(doc, "text");

    drawStayBlock(doc, 50, { ...fullData, bondDeposit: "200.00" });

    const drawn = textSpy.mock.calls.map((call) => call[0]);
    expect(drawn).toContain("200.00");
  });
});
