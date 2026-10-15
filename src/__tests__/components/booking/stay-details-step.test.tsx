import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { StayDetailsStep } from "@/components/booking/steps/stay-details-step";
import type { RoomSummary } from "@/types/room";
import type { StayDetails } from "@/hooks/use-booking-form";

// jsdom lacks these; Radix Select touches them.
beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const rooms: RoomSummary[] = [
  { id: "r-1", roomNumber: "101", capacity: 2, pricePerNight: "120", description: null },
];

const stay: StayDetails = {
  checkIn: "2026-05-01",
  checkInTime: "14:00",
  checkOut: "2026-05-03",
  checkOutTime: "10:00",
  roomId: "r-1",
  bondDeposit: "",
  notes: "",
};

function renderStep() {
  return render(
    <StayDetailsStep
      stay={stay}
      availableRooms={rooms}
      selectedRoom={rooms[0]}
      isLoadingRooms={false}
      nights={2}
      pricePerNight={120}
      onCheckInChange={vi.fn()}
      onCheckInTimeChange={vi.fn()}
      onCheckOutChange={vi.fn()}
      onCheckOutTimeChange={vi.fn()}
      onRoomIdChange={vi.fn()}
      onBondDepositChange={vi.fn()}
      onNotesChange={vi.fn()}
    />,
  );
}

describe("StayDetailsStep labels", () => {
  it("pairs the room label with the select trigger", () => {
    renderStep();

    const trigger = screen.getByLabelText("Room *");

    expect(trigger).toHaveAttribute("id", "room");
    expect(trigger).toHaveAttribute("role", "combobox");
  });

  it("pairs 'Number of Nights' with its read-only field", () => {
    renderStep();

    const nights = screen.getByLabelText("Number of Nights");

    expect(nights).toHaveAttribute("id", "nights");
    expect(nights).toBeDisabled();
    expect(nights).toHaveValue("2");
  });

  it("pairs 'Room Rate' with its read-only field", () => {
    renderStep();

    const rate = screen.getByLabelText("Room Rate");

    expect(rate).toHaveAttribute("id", "roomRate");
    expect(rate).toBeDisabled();
    expect(rate).toHaveValue("$120/night");
  });
});
