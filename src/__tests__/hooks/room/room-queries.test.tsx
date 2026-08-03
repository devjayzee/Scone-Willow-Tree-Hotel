import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockFetchRooms = vi.fn();
const mockFetchAvailableRooms = vi.fn();
vi.mock("@/hooks/room/room-api", () => ({
  fetchRooms: (...args: unknown[]) => mockFetchRooms(...args),
  fetchAvailableRooms: (...args: unknown[]) => mockFetchAvailableRooms(...args),
}));

import type { Room, RoomSummary } from "@/types/room";
import { useRooms, useAvailableRooms } from "@/hooks/room/room-queries";

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: "r-1",
    roomNumber: "101",
    capacity: 2,
    pricePerNight: 100,
    description: null,
    ...overrides,
  };
}

function makeRoomSummary(overrides: Partial<RoomSummary> = {}): RoomSummary {
  return {
    id: "r-1",
    roomNumber: "101",
    capacity: 2,
    pricePerNight: 100,
    ...overrides,
  };
}

describe("useRooms", () => {
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

  it("uses initialData without hitting the network", () => {
    const seeded = [makeRoom({ id: "seed" })];

    const { result } = renderHook(() => useRooms(seeded, Date.now()), {
      wrapper,
    });

    expect(result.current.data).toEqual(seeded);
    expect(mockFetchRooms).not.toHaveBeenCalled();
  });

  it("surfaces fetched data through result.current.data", async () => {
    const fetched = [makeRoom({ id: "fetched" })];
    mockFetchRooms.mockResolvedValue(fetched);

    const { result } = renderHook(() => useRooms(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(fetched);
    });
    expect(mockFetchRooms).toHaveBeenCalledTimes(1);
  });
});

describe("useAvailableRooms", () => {
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

  it("does NOT call the API when checkIn is empty", async () => {
    renderHook(() => useAvailableRooms("", "2026-05-05"), { wrapper });

    // Give React a tick to run any pending effects; then assert no fetch happened.
    await new Promise((r) => setTimeout(r, 20));
    expect(mockFetchAvailableRooms).not.toHaveBeenCalled();
  });

  it("does NOT call the API when checkOut is empty", async () => {
    renderHook(() => useAvailableRooms("2026-05-01", ""), { wrapper });

    await new Promise((r) => setTimeout(r, 20));
    expect(mockFetchAvailableRooms).not.toHaveBeenCalled();
  });

  it("calls the API and returns data when both dates are set", async () => {
    const fetched = [makeRoomSummary({ id: "avail-1" })];
    mockFetchAvailableRooms.mockResolvedValue(fetched);

    const { result } = renderHook(
      () => useAvailableRooms("2026-05-01", "2026-05-05"),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(fetched);
    });
    expect(mockFetchAvailableRooms).toHaveBeenCalledWith("2026-05-01", "2026-05-05");
  });
});
