import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, unlinkSync } from "node:fs";

const mockGetLogoBase64 = vi.fn();

vi.mock("@/lib/utils/pdf/booking-registration/pdf-helpers", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/utils/pdf/booking-registration/pdf-helpers")
  >("@/lib/utils/pdf/booking-registration/pdf-helpers");
  return {
    ...actual,
    getLogoBase64: () => mockGetLogoBase64(),
  };
});

import {
  generateBookingRegistrationPDF,
  downloadBookingPDF,
  downloadDraftBookingPDF,
  bookingToPDFData,
} from "@/lib/utils/pdf/booking-registration/index";
import type { BookingPDFData } from "@/lib/utils/pdf/booking-registration/pdf-types";
import type { Booking } from "@/types/booking";

const pdfData: BookingPDFData = {
  guestName: "Jane Doe",
  guestPhone: "0412345678",
  checkIn: "2026-05-01",
  checkOut: "2026-05-03",
  roomNumber: "101",
  pricePerNight: 150,
};

const booking: Booking = {
  id: "b1",
  bookingRef: "BK-20260501-001",
  roomId: "r1",
  guestName: "Jane Doe",
  guestDateOfBirth: null,
  guestAddress: null,
  guestEmail: null,
  guestPhone: "0412345678",
  vehicleRego: null,
  additionalGuests: null,
  checkIn: "2026-05-01T00:00:00.000Z",
  checkInTime: null,
  checkOut: "2026-05-03T00:00:00.000Z",
  checkOutTime: null,
  bondDeposit: null,
  ratePerNight: "150.00",
  status: "CONFIRMED",
  isPaid: false,
  notes: null,
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-01T00:00:00.000Z",
  room: { id: "r1", roomNumber: "101", capacity: 2, pricePerNight: "150.00" },
};

// jsPDF isn't a real ES6 class internally (subclassing/spying on .save
// doesn't work — verified directly), and in this Node test environment
// .save() falls back to actually writing a file to cwd instead of
// triggering a browser download. Rather than fight the library's
// internals, let it write for real and clean up afterward.
const WRITTEN_FILES = [
  "guest-registration-jane-doe.pdf",
  "guest-registration-bob-builder.pdf",
];

describe("booking-registration/index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLogoBase64.mockResolvedValue(null);
  });

  afterEach(() => {
    for (const file of WRITTEN_FILES) {
      if (existsSync(file)) unlinkSync(file);
    }
  });

  describe("generateBookingRegistrationPDF", () => {
    it("returns a document that renders non-trivial PDF output", () => {
      const doc = generateBookingRegistrationPDF(pdfData, null);

      expect(typeof doc.output).toBe("function");
      expect(doc.output().length).toBeGreaterThan(100);
    });
  });

  describe("downloadBookingPDF", () => {
    it("converts the booking, generates a PDF, and saves it under a slugified filename", async () => {
      await downloadBookingPDF(booking);

      expect(mockGetLogoBase64).toHaveBeenCalledTimes(1);
      expect(existsSync("guest-registration-jane-doe.pdf")).toBe(true);
    });
  });

  describe("downloadDraftBookingPDF", () => {
    it("generates a PDF from draft data and saves it under a slugified filename", async () => {
      await downloadDraftBookingPDF(pdfData, "Bob Builder");

      expect(mockGetLogoBase64).toHaveBeenCalledTimes(1);
      expect(existsSync("guest-registration-bob-builder.pdf")).toBe(true);
    });
  });

  describe("bookingToPDFData re-export", () => {
    it("is the same function exported from pdf-types", async () => {
      const { bookingToPDFData: original } = await import(
        "@/lib/utils/pdf/booking-registration/pdf-types"
      );
      expect(bookingToPDFData).toBe(original);
    });
  });
});
