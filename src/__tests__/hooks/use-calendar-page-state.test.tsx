import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockUseCalendarEvents = vi.fn();
const mockFetchBooking = vi.fn();

vi.mock("@/hooks/use-calendar", () => ({
  useCalendarEvents: (...args: unknown[]) => mockUseCalendarEvents(...args),
}));

vi.mock("@/hooks/booking", () => ({
  useFetchBooking: () => mockFetchBooking,
}));

import type { CalendarEvent } from "@/types/calendar";
import type { Booking } from "@/types/booking";
import { useCalendarPageState } from "@/hooks/use-calendar-page-state";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "b-1",
    title: "Room 101 - Jane Doe",
    start: "2026-05-01T14:00:00.000Z",
    end: "2026-05-02T10:00:00.000Z",
    resource: {
      bookingRef: "BK-20260501-001",
      guestName: "Jane Doe",
      guestPhone: "0412345678",
      roomNumber: "101",
      roomId: "r-1",
      status: "CONFIRMED",
    },
    ...overrides,
  };
}

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "b-1",
    bookingRef: "BK-20260501-001",
    roomId: "r-1",
    guestName: "Jane Doe",
    guestPhone: "0412345678",
    checkIn: "2026-05-01",
    checkOut: "2026-05-02",
    ratePerNight: "120",
    status: "CONFIRMED",
    isPaid: false,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    room: { id: "r-1", roomNumber: "101", capacity: 2, pricePerNight: "120" },
    ...overrides,
  };
}

function setup(initialEvents: CalendarEvent[] = []) {
  mockUseCalendarEvents.mockReturnValue({
    data: initialEvents,
    refetch: vi.fn(),
    isLoading: false,
    isFetching: false,
  });
  return renderHook(() => useCalendarPageState({ initialEvents }));
}

describe("useCalendarPageState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to month view and today's date", () => {
    const { result } = setup();

    expect(result.current.view).toBe("month");
    expect(result.current.date.toDateString()).toBe(new Date().toDateString());
  });

  it("seeds initialData into useCalendarEvents while the query window matches the initial one", () => {
    const events = [makeEvent()];
    setup(events);

    const call = mockUseCalendarEvents.mock.calls[0];
    // (initialData, startDate, endDate, roomId, initialDataUpdatedAt)
    expect(call[0]).toEqual(events);
    expect(call[4]).toBeUndefined(); // no fetchTime passed in this setup
  });

  it("stops seeding initialData once the view date moves the query window", () => {
    const events = [makeEvent()];
    const { result } = setup(events);

    act(() => result.current.handleNavigate(new Date("2027-01-01")));

    const lastCall =
      mockUseCalendarEvents.mock.calls[mockUseCalendarEvents.mock.calls.length - 1];
    expect(lastCall[0]).toBeUndefined();
  });

  it("converts ISO event start/end into Date objects for localEvents", () => {
    const events = [makeEvent()];
    const { result } = setup(events);

    expect(result.current.localEvents).toHaveLength(1);
    expect(result.current.localEvents[0].start).toBeInstanceOf(Date);
    expect(result.current.localEvents[0].end).toBeInstanceOf(Date);
    expect(result.current.localEvents[0].start.toISOString()).toBe(
      events[0].start,
    );
  });

  it("handleNavigate updates the view date", () => {
    const { result } = setup();
    const newDate = new Date("2026-08-15");

    act(() => result.current.handleNavigate(newDate));

    expect(result.current.date).toBe(newDate);
  });

  it("handleViewChange switches between month and week", () => {
    const { result } = setup();

    act(() => result.current.handleViewChange("week"));

    expect(result.current.view).toBe("week");
  });

  describe("fetchAndShowBooking (via handleSelectLocalEvent / handleSelectCalendarEvent)", () => {
    it("fetches the booking and opens the details dialog", async () => {
      const booking = makeBooking();
      mockFetchBooking.mockResolvedValue(booking);
      const { result } = setup();

      await act(async () => {
        await result.current.handleSelectCalendarEvent(makeEvent({ id: "b-1" }));
      });

      expect(mockFetchBooking).toHaveBeenCalledWith("b-1");
      expect(result.current.selectedBooking).toBe(booking);
      expect(result.current.detailsDialogOpen).toBe(true);
    });

    it("strips the ::yyyy-MM-dd suffix multi-night events carry before fetching", async () => {
      mockFetchBooking.mockResolvedValue(makeBooking());
      const { result } = setup();

      await act(async () => {
        await result.current.handleSelectLocalEvent({
          ...makeEvent(),
          id: "b-1::2026-05-02",
          start: new Date(),
          end: new Date(),
        });
      });

      expect(mockFetchBooking).toHaveBeenCalledWith("b-1");
    });

    it("does not open the dialog when the booking fetch returns null", async () => {
      mockFetchBooking.mockResolvedValue(null);
      const { result } = setup();

      await act(async () => {
        await result.current.handleSelectCalendarEvent(makeEvent());
      });

      expect(result.current.detailsDialogOpen).toBe(false);
      expect(result.current.selectedBooking).toBeNull();
    });
  });
});
