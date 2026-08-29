import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const makeMutation = () => ({
  mutateAsync: vi.fn(),
  isPending: false,
});
const mockUseRooms = vi.fn();
const mockCreate = makeMutation();
const mockUpdate = makeMutation();
const mockDelete = makeMutation();

vi.mock("@/hooks/room", () => ({
  useRooms: (...args: unknown[]) => mockUseRooms(...args),
  useCreateRoom: () => mockCreate,
  useUpdateRoom: () => mockUpdate,
  useDeleteRoom: () => mockDelete,
}));

import type { Room } from "@/types/room";
import { useRoomManagement } from "@/hooks/use-room-management";

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: "r-1",
    roomNumber: "101",
    capacity: 2,
    pricePerNight: "120",
    description: "Standard room",
    ...overrides,
  };
}

const roomFormData = {
  roomNumber: "102",
  capacity: 3,
  pricePerNight: 150,
  description: "Deluxe room",
};

function setup(initialRooms: Room[] = []) {
  mockUseRooms.mockReturnValue({
    data: initialRooms,
    error: null,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  });
  return renderHook(() => useRoomManagement({ initialRooms }));
}

describe("useRoomManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.isPending = false;
    mockUpdate.isPending = false;
    mockDelete.isPending = false;
  });

  describe("dialog open callbacks", () => {
    it("openAddDialog clears selection and opens the room dialog", () => {
      const { result } = setup();
      act(() => result.current.openAddDialog());

      expect(result.current.selectedRoom).toBeNull();
      expect(result.current.roomDialogOpen).toBe(true);
    });

    it("openEditDialog selects a room and opens the room dialog", () => {
      const room = makeRoom();
      const { result } = setup();
      act(() => result.current.openEditDialog(room));

      expect(result.current.selectedRoom).toBe(room);
      expect(result.current.roomDialogOpen).toBe(true);
    });

    it("openDeleteDialog selects a room and opens the delete dialog", () => {
      const room = makeRoom();
      const { result } = setup();
      act(() => result.current.openDeleteDialog(room));

      expect(result.current.selectedRoom).toBe(room);
      expect(result.current.deleteDialogOpen).toBe(true);
    });
  });

  describe("saveRoom", () => {
    it("calls createMutation when no room is selected", async () => {
      mockCreate.mutateAsync.mockResolvedValue(makeRoom());
      const { result } = setup();

      await act(async () => {
        await result.current.saveRoom(roomFormData);
      });

      expect(mockCreate.mutateAsync).toHaveBeenCalledWith(roomFormData);
      expect(mockUpdate.mutateAsync).not.toHaveBeenCalled();
    });

    it("calls updateMutation with the selected room's id when editing", async () => {
      mockUpdate.mutateAsync.mockResolvedValue(makeRoom());
      const existing = makeRoom({ id: "r-existing" });
      const { result } = setup();
      act(() => result.current.openEditDialog(existing));

      await act(async () => {
        await result.current.saveRoom(roomFormData);
      });

      expect(mockUpdate.mutateAsync).toHaveBeenCalledWith({
        id: "r-existing",
        data: roomFormData,
      });
      expect(mockCreate.mutateAsync).not.toHaveBeenCalled();
    });
  });

  describe("confirmDelete", () => {
    it("does nothing when no room is selected", async () => {
      const { result } = setup();

      await act(async () => {
        await result.current.confirmDelete();
      });

      expect(mockDelete.mutateAsync).not.toHaveBeenCalled();
    });

    it("deletes the selected room and closes the delete dialog", async () => {
      mockDelete.mutateAsync.mockResolvedValue(undefined);
      const room = makeRoom();
      const { result } = setup();
      act(() => result.current.openDeleteDialog(room));

      await act(async () => {
        await result.current.confirmDelete();
      });

      expect(mockDelete.mutateAsync).toHaveBeenCalledWith(room.id);
      expect(result.current.deleteDialogOpen).toBe(false);
    });

    it("swallows a delete error (handled by the mutation's onError)", async () => {
      mockDelete.mutateAsync.mockRejectedValue(new Error("boom"));
      const room = makeRoom();
      const { result } = setup();
      act(() => result.current.openDeleteDialog(room));

      await act(async () => {
        await result.current.confirmDelete();
      });

      // Dialog stays open on failure — the catch block only closes it on success.
      expect(result.current.deleteDialogOpen).toBe(true);
    });
  });

  describe("search filtering", () => {
    it("filters rooms by room number or description, case-insensitively", () => {
      const rooms = [
        makeRoom({ id: "r-1", roomNumber: "101", description: "Ocean view" }),
        makeRoom({ id: "r-2", roomNumber: "202", description: "Garden view" }),
      ];
      const { result } = setup(rooms);

      act(() => result.current.updateSearch("ocean"));
      expect(result.current.filteredRooms).toEqual([rooms[0]]);

      act(() => result.current.updateSearch("202"));
      expect(result.current.filteredRooms).toEqual([rooms[1]]);

      act(() => result.current.updateSearch(""));
      expect(result.current.filteredRooms).toEqual(rooms);
    });
  });

  describe("isDeleting", () => {
    it("reflects the delete mutation's pending state", () => {
      mockDelete.isPending = true;
      const { result } = setup();

      expect(result.current.isDeleting).toBe(true);
    });
  });
});
