import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const makeMutation = () => ({
  mutateAsync: vi.fn(),
  isPending: false,
});
const mockUseStaffs = vi.fn();
const mockCreate = makeMutation();
const mockUpdate = makeMutation();
const mockDelete = makeMutation();
const mockToggleActive = makeMutation();
const mockResendInvite = makeMutation();

vi.mock("@/hooks/staff", () => ({
  useStaffs: (...args: unknown[]) => mockUseStaffs(...args),
  useCreateStaff: () => mockCreate,
  useUpdateStaff: () => mockUpdate,
  useDeleteStaff: () => mockDelete,
  useToggleStaffActive: () => mockToggleActive,
  useResendInvite: () => mockResendInvite,
}));

import type { Staff } from "@/types/staff";
import { useStaffManagement } from "@/hooks/use-staff-management";

function makeStaff(overrides: Partial<Staff> = {}): Staff {
  return {
    id: "s-1",
    firstName: "Jane",
    lastName: "Smith",
    email: "jane@sconewillowtree.com",
    role: "STAFF",
    isActive: true,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    _count: { bookings: 0 },
    ...overrides,
  };
}

const formData = {
  firstName: "New",
  lastName: "Hire",
  email: "new.hire@sconewillowtree.com",
  role: "STAFF" as const,
};

function setup(initialStaffs: Staff[] = []) {
  mockUseStaffs.mockReturnValue({
    data: initialStaffs,
    error: null,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  });
  return renderHook(() => useStaffManagement({ initialStaffs }));
}

describe("useStaffManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.isPending = false;
    mockUpdate.isPending = false;
    mockDelete.isPending = false;
    mockToggleActive.isPending = false;
  });

  describe("dialog open callbacks", () => {
    it("openAddDialog clears selection and opens the staff dialog", () => {
      const { result } = setup();
      act(() => result.current.openAddDialog());

      expect(result.current.selectedStaff).toBeNull();
      expect(result.current.staffDialogOpen).toBe(true);
    });

    it("openEditDialog selects a staff member and opens the staff dialog", () => {
      const staff = makeStaff();
      const { result } = setup();
      act(() => result.current.openEditDialog(staff));

      expect(result.current.selectedStaff).toBe(staff);
      expect(result.current.staffDialogOpen).toBe(true);
    });

    it("openDeleteDialog selects a staff member and opens the delete dialog", () => {
      const staff = makeStaff();
      const { result } = setup();
      act(() => result.current.openDeleteDialog(staff));

      expect(result.current.selectedStaff).toBe(staff);
      expect(result.current.deleteDialogOpen).toBe(true);
    });
  });

  describe("saveStaff", () => {
    it("calls createMutation (no password) when no staff is selected", async () => {
      mockCreate.mutateAsync.mockResolvedValue(makeStaff());
      const { result } = setup();

      await act(async () => {
        await result.current.saveStaff(formData);
      });

      expect(mockCreate.mutateAsync).toHaveBeenCalledWith(formData);
      expect(mockUpdate.mutateAsync).not.toHaveBeenCalled();
      expect(result.current.staffDialogOpen).toBe(false);
      expect(result.current.selectedStaff).toBeNull();
    });

    it("calls updateMutation with the selected staff's id, excluding password rotation", async () => {
      mockUpdate.mutateAsync.mockResolvedValue(makeStaff());
      const existing = makeStaff({ id: "s-existing" });
      const { result } = setup();
      act(() => result.current.openEditDialog(existing));

      await act(async () => {
        await result.current.saveStaff(formData);
      });

      expect(mockUpdate.mutateAsync).toHaveBeenCalledWith({
        id: "s-existing",
        data: formData,
      });
      expect(mockCreate.mutateAsync).not.toHaveBeenCalled();
      expect(result.current.staffDialogOpen).toBe(false);
      expect(result.current.selectedStaff).toBeNull();
    });
  });

  describe("confirmDelete", () => {
    it("does nothing when no staff is selected", async () => {
      const { result } = setup();

      await act(async () => {
        await result.current.confirmDelete();
      });

      expect(mockDelete.mutateAsync).not.toHaveBeenCalled();
    });

    it("deletes the selected staff and closes the delete dialog", async () => {
      mockDelete.mutateAsync.mockResolvedValue(undefined);
      const staff = makeStaff();
      const { result } = setup();
      act(() => result.current.openDeleteDialog(staff));

      await act(async () => {
        await result.current.confirmDelete();
      });

      expect(mockDelete.mutateAsync).toHaveBeenCalledWith(staff.id);
      expect(result.current.deleteDialogOpen).toBe(false);
      expect(result.current.selectedStaff).toBeNull();
    });

    it("swallows a delete error (handled by the mutation's onError)", async () => {
      mockDelete.mutateAsync.mockRejectedValue(new Error("boom"));
      const staff = makeStaff();
      const { result } = setup();
      act(() => result.current.openDeleteDialog(staff));

      await act(async () => {
        await result.current.confirmDelete();
      });

      expect(result.current.deleteDialogOpen).toBe(true);
    });
  });

  describe("toggleActive", () => {
    it("flips isActive via the toggle mutation", async () => {
      const staff = makeStaff({ isActive: true });
      const { result } = setup();

      await act(async () => {
        await result.current.toggleActive(staff);
      });

      expect(mockToggleActive.mutateAsync).toHaveBeenCalledWith({
        id: staff.id,
        isActive: false,
      });
    });
  });

  describe("resendInvite", () => {
    it("resends an invite for the given staff id", async () => {
      const staff = makeStaff({ isActive: false });
      const { result } = setup();

      await act(async () => {
        await result.current.resendInvite(staff);
      });

      expect(mockResendInvite.mutateAsync).toHaveBeenCalledWith(staff.id);
    });
  });

  describe("search filtering", () => {
    it("filters staff by first name, last name, or email, case-insensitively", () => {
      const staffs = [
        makeStaff({ id: "s-1", firstName: "Alice", lastName: "Baker", email: "alice@x.com" }),
        makeStaff({ id: "s-2", firstName: "Bob", lastName: "Carter", email: "bob@x.com" }),
      ];
      const { result } = setup(staffs);

      act(() => result.current.updateSearch("alice"));
      expect(result.current.filteredStaffs).toEqual([staffs[0]]);

      act(() => result.current.updateSearch("carter"));
      expect(result.current.filteredStaffs).toEqual([staffs[1]]);

      act(() => result.current.updateSearch(""));
      expect(result.current.filteredStaffs).toEqual(staffs);
    });
  });

  describe("isProcessing", () => {
    it("is true when any mutation is pending", () => {
      mockToggleActive.isPending = true;
      const { result } = setup();

      expect(result.current.isProcessing).toBe(true);
    });
  });
});
