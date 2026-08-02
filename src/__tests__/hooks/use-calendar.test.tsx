import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { CalendarEvent } from "@/types/calendar";
import {
  calendarKeys,
  useCalendarEvents,
  useInvalidateCalendarEvents,
} from "@/hooks/use-calendar";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "e-1",
    title: "Test event",
    start: "2026-05-01T14:00:00.000Z",
    end: "2026-05-05T10:00:00.000Z",
    resource: {
      bookingRef: "BK-1",
      guestName: "Guest",
      guestPhone: "0400000000",
      roomNumber: "101",
      roomId: "r-1",
      status: "CONFIRMED",
    },
    ...overrides,
  };
}

describe("useCalendarEvents", () => {
  let queryClient: QueryClient;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("uses initialData without calling fetch", () => {
    const seeded = [makeEvent({ id: "seed" })];

    const { result } = renderHook(
      () => useCalendarEvents(seeded, "2026-05-01", "2026-05-31", undefined, Date.now()),
      { wrapper }
    );

    expect(result.current.data).toEqual(seeded);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("calls the API with encoded start + end params when both dates supplied", async () => {
    const fetched = [makeEvent({ id: "fetched" })];
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => fetched,
    });

    const { result } = renderHook(
      () => useCalendarEvents(undefined, "2026-05-01", "2026-05-31"),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(fetched);
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/calendar?start=2026-05-01&end=2026-05-31"
    );
  });
});

describe("useInvalidateCalendarEvents", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("invalidates the calendar events cache when invoked", () => {
    const spy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useInvalidateCalendarEvents(), {
      wrapper,
    });

    result.current();

    expect(spy).toHaveBeenCalledWith({ queryKey: calendarKeys.events() });
  });
});
