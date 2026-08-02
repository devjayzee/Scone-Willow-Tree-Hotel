import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

const mockInvalidateWithRelated = vi.fn();
vi.mock("@/lib/query-invalidation", () => ({
  invalidateWithRelated: (...args: unknown[]) =>
    mockInvalidateWithRelated(...args),
}));

const mockCreateRoom = vi.fn();
const mockUpdateRoom = vi.fn();
const mockDeleteRoom = vi.fn();
vi.mock("@/hooks/room/room-api", () => ({
  createRoom: (...args: unknown[]) => mockCreateRoom(...args),
  updateRoom: (...args: unknown[]) => mockUpdateRoom(...args),
  deleteRoom: (...args: unknown[]) => mockDeleteRoom(...args),
}));

import type { Room } from "@/types/room";
import { roomKeys } from "@/hooks/room/room-keys";
import {
  useCreateRoom,
  useUpdateRoom,
  useDeleteRoom,
} from "@/hooks/room/room-mutations";

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

const createInput = {
  roomNumber: "105",
  capacity: 2,
  pricePerNight: 120,
  description: "New room",
};

describe("room mutation hooks", () => {
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

  describe("useCreateRoom", () => {
    it("inserts the optimistic room and re-sorts by room number", async () => {
      // Use non-lexical ordering to catch parseInt-based sort behavior.
      const rooms = [
        makeRoom({ id: "r-a", roomNumber: "9" }),
        makeRoom({ id: "r-b", roomNumber: "101" }),
      ];
      queryClient.setQueryData<Room[]>(roomKeys.list(), rooms);

      mockCreateRoom.mockResolvedValue(makeRoom({ id: "server-1", roomNumber: "20" }));

      const { result } = renderHook(() => useCreateRoom(), { wrapper });
      const promise = result.current.mutateAsync({
        ...createInput,
        roomNumber: "20",
      });

      await waitFor(() => {
        const cache = queryClient.getQueryData<Room[]>(roomKeys.list());
        expect(cache?.map((r) => r.roomNumber)).toEqual(["9", "20", "101"]);
        expect(cache?.[1].id).toMatch(/^temp-/);
      });

      await promise;

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("Room created successfully");
      });
      expect(mockInvalidateWithRelated).toHaveBeenCalledWith(queryClient, "rooms");
    });

    it("rolls back the optimistic room on error", async () => {
      const snapshot = [makeRoom({ id: "snap", roomNumber: "101" })];
      queryClient.setQueryData<Room[]>(roomKeys.list(), snapshot);

      mockCreateRoom.mockRejectedValue(new Error("create failed"));

      const { result } = renderHook(() => useCreateRoom(), { wrapper });

      await expect(result.current.mutateAsync(createInput)).rejects.toThrow(
        "create failed"
      );

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("create failed");
      });
      expect(queryClient.getQueryData<Room[]>(roomKeys.list())).toEqual(snapshot);
    });
  });

  describe("useUpdateRoom", () => {
    it("optimistically merges field changes on the matching room", async () => {
      const original = makeRoom({ id: "u-1", roomNumber: "101", capacity: 2 });
      queryClient.setQueryData<Room[]>(roomKeys.list(), [original]);

      mockUpdateRoom.mockResolvedValue(makeRoom({ id: "u-1", capacity: 3 }));

      const { result } = renderHook(() => useUpdateRoom(), { wrapper });
      const promise = result.current.mutateAsync({
        id: "u-1",
        data: { roomNumber: "101", capacity: 3, pricePerNight: 100 },
      });

      await waitFor(() => {
        const cache = queryClient.getQueryData<Room[]>(roomKeys.list());
        expect(cache?.[0].capacity).toBe(3);
      });

      await promise;

      expect(mockInvalidateWithRelated).toHaveBeenCalledWith(queryClient, "rooms");
    });

    it("re-sorts when a room number changes", async () => {
      const rooms = [
        makeRoom({ id: "r-a", roomNumber: "9" }),
        makeRoom({ id: "r-b", roomNumber: "50" }),
        makeRoom({ id: "r-c", roomNumber: "101" }),
      ];
      queryClient.setQueryData<Room[]>(roomKeys.list(), rooms);

      mockUpdateRoom.mockResolvedValue(makeRoom({ id: "r-c", roomNumber: "10" }));

      const { result } = renderHook(() => useUpdateRoom(), { wrapper });
      await result.current.mutateAsync({
        id: "r-c",
        data: { roomNumber: "10", capacity: 2, pricePerNight: 100 },
      });

      await waitFor(() => {
        const cache = queryClient.getQueryData<Room[]>(roomKeys.list());
        expect(cache?.map((r) => r.roomNumber)).toEqual(["9", "10", "50"]);
      });
    });

    it("rolls back on error", async () => {
      const snapshot = [makeRoom({ id: "u-1", roomNumber: "101" })];
      queryClient.setQueryData<Room[]>(roomKeys.list(), snapshot);

      mockUpdateRoom.mockRejectedValue(new Error("update failed"));

      const { result } = renderHook(() => useUpdateRoom(), { wrapper });

      await expect(
        result.current.mutateAsync({
          id: "u-1",
          data: { roomNumber: "999", capacity: 2, pricePerNight: 100 },
        })
      ).rejects.toThrow("update failed");

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("update failed");
      });
      expect(queryClient.getQueryData<Room[]>(roomKeys.list())).toEqual(snapshot);
    });
  });

  describe("useDeleteRoom", () => {
    it("removes the room optimistically and toasts on success", async () => {
      const keep = makeRoom({ id: "keep" });
      const drop = makeRoom({ id: "drop", roomNumber: "999" });
      queryClient.setQueryData<Room[]>(roomKeys.list(), [keep, drop]);

      mockDeleteRoom.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteRoom(), { wrapper });
      const promise = result.current.mutateAsync("drop");

      await waitFor(() => {
        expect(queryClient.getQueryData<Room[]>(roomKeys.list())).toEqual([keep]);
      });

      await promise;

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("Room deleted successfully");
      });
    });

    it("rolls back on error", async () => {
      const snapshot = [makeRoom({ id: "keep" }), makeRoom({ id: "drop" })];
      queryClient.setQueryData<Room[]>(roomKeys.list(), snapshot);

      mockDeleteRoom.mockRejectedValue(new Error("delete failed"));

      const { result } = renderHook(() => useDeleteRoom(), { wrapper });

      await expect(result.current.mutateAsync("drop")).rejects.toThrow(
        "delete failed"
      );

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("delete failed");
      });
      expect(queryClient.getQueryData<Room[]>(roomKeys.list())).toEqual(snapshot);
    });
  });
});
