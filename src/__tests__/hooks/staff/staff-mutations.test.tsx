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

const mockCreateStaff = vi.fn();
const mockUpdateStaff = vi.fn();
const mockDeleteStaff = vi.fn();
vi.mock("@/hooks/staff/staff-api", () => ({
  createStaff: (...args: unknown[]) => mockCreateStaff(...args),
  updateStaff: (...args: unknown[]) => mockUpdateStaff(...args),
  deleteStaff: (...args: unknown[]) => mockDeleteStaff(...args),
}));

import type { Staff, Role } from "@/types/staff";
import { staffKeys } from "@/hooks/staff/staff-keys";
import {
  useCreateStaff,
  useUpdateStaff,
  useDeleteStaff,
  useToggleStaffActive,
} from "@/hooks/staff/staff-mutations";

function makeStaff(overrides: Partial<Staff> = {}): Staff {
  return {
    id: "s-1",
    firstName: "Alice",
    lastName: "Smith",
    email: "alice@example.com",
    role: "STAFF" as Role,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    _count: { bookings: 0 },
    ...overrides,
  };
}

const createInput = {
  firstName: "Bob",
  lastName: "Jones",
  email: "bob@example.com",
  role: "STAFF" as Role,
};

describe("staff mutation hooks", () => {
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

  describe("useCreateStaff", () => {
    it("prepends an optimistic staff with a temp id", async () => {
      const existing = makeStaff({ id: "existing", firstName: "Existing" });
      queryClient.setQueryData<Staff[]>(staffKeys.list(), [existing]);

      mockCreateStaff.mockResolvedValue(
        makeStaff({ id: "server-1", firstName: "Bob", email: "bob@example.com" })
      );

      const { result } = renderHook(() => useCreateStaff(), { wrapper });
      const promise = result.current.mutateAsync(createInput);

      await waitFor(() => {
        const cache = queryClient.getQueryData<Staff[]>(staffKeys.list());
        expect(cache?.length).toBe(2);
        expect(cache?.[0].id).toMatch(/^temp-/);
        expect(cache?.[0].firstName).toBe("Bob");
        expect(cache?.[1]).toEqual(existing);
      });

      await promise;

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("Invite sent to bob@example.com");
      });
      expect(mockInvalidateWithRelated).toHaveBeenCalledWith(queryClient, "staff");
    });

    it("rolls back the optimistic staff on error", async () => {
      const snapshot = [makeStaff({ id: "snap" })];
      queryClient.setQueryData<Staff[]>(staffKeys.list(), snapshot);

      mockCreateStaff.mockRejectedValue(new Error("create failed"));

      const { result } = renderHook(() => useCreateStaff(), { wrapper });

      await expect(result.current.mutateAsync(createInput)).rejects.toThrow(
        "create failed"
      );

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("create failed");
      });
      expect(queryClient.getQueryData<Staff[]>(staffKeys.list())).toEqual(snapshot);
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });
  });

  describe("useUpdateStaff", () => {
    it("optimistically merges field changes and settles on resolve", async () => {
      const original = makeStaff({ id: "u-1", firstName: "Old" });
      queryClient.setQueryData<Staff[]>(staffKeys.list(), [original]);

      mockUpdateStaff.mockResolvedValue(makeStaff({ id: "u-1", firstName: "New" }));

      const { result } = renderHook(() => useUpdateStaff(), { wrapper });
      const promise = result.current.mutateAsync({
        id: "u-1",
        data: { firstName: "New" },
      });

      await waitFor(() => {
        const cache = queryClient.getQueryData<Staff[]>(staffKeys.list());
        expect(cache?.[0].firstName).toBe("New");
      });

      await promise;

      expect(mockInvalidateWithRelated).toHaveBeenCalledWith(queryClient, "staff");
    });

    it("rolls back on error", async () => {
      const snapshot = [makeStaff({ id: "u-1", firstName: "Original" })];
      queryClient.setQueryData<Staff[]>(staffKeys.list(), snapshot);

      mockUpdateStaff.mockRejectedValue(new Error("update failed"));

      const { result } = renderHook(() => useUpdateStaff(), { wrapper });

      await expect(
        result.current.mutateAsync({ id: "u-1", data: { firstName: "New" } })
      ).rejects.toThrow("update failed");

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("update failed");
      });
      expect(queryClient.getQueryData<Staff[]>(staffKeys.list())).toEqual(snapshot);
    });
  });

  describe("useDeleteStaff", () => {
    it("removes the staff optimistically and toasts on delete", async () => {
      const keep = makeStaff({ id: "keep" });
      const drop = makeStaff({ id: "drop" });
      queryClient.setQueryData<Staff[]>(staffKeys.list(), [keep, drop]);

      mockDeleteStaff.mockResolvedValue({ message: "ok" });

      const { result } = renderHook(() => useDeleteStaff(), { wrapper });
      const promise = result.current.mutateAsync("drop");

      await waitFor(() => {
        expect(queryClient.getQueryData<Staff[]>(staffKeys.list())).toEqual([keep]);
      });

      await promise;

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("Staff deleted successfully");
      });
    });

    it("uses the deactivated toast when the API reports deactivation", async () => {
      queryClient.setQueryData<Staff[]>(staffKeys.list(), [makeStaff({ id: "d-1" })]);

      mockDeleteStaff.mockResolvedValue({ message: "deactivated", deactivated: true });

      const { result } = renderHook(() => useDeleteStaff(), { wrapper });
      await result.current.mutateAsync("d-1");

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          "Staff deactivated (has active bookings)"
        );
      });
    });

    it("rolls back on error", async () => {
      const snapshot = [makeStaff({ id: "keep" }), makeStaff({ id: "drop" })];
      queryClient.setQueryData<Staff[]>(staffKeys.list(), snapshot);

      mockDeleteStaff.mockRejectedValue(new Error("delete failed"));

      const { result } = renderHook(() => useDeleteStaff(), { wrapper });

      await expect(result.current.mutateAsync("drop")).rejects.toThrow(
        "delete failed"
      );

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("delete failed");
      });
      expect(queryClient.getQueryData<Staff[]>(staffKeys.list())).toEqual(snapshot);
    });
  });

  describe("useToggleStaffActive", () => {
    it("composes updateStaff with { id, data: { isActive } } and toasts activated", async () => {
      queryClient.setQueryData<Staff[]>(staffKeys.list(), [
        makeStaff({ id: "t-1", isActive: false }),
      ]);

      mockUpdateStaff.mockResolvedValue(makeStaff({ id: "t-1", isActive: true }));

      const { result } = renderHook(() => useToggleStaffActive(), { wrapper });
      await result.current.mutateAsync({ id: "t-1", isActive: true });

      expect(mockUpdateStaff).toHaveBeenCalledWith({
        id: "t-1",
        data: { isActive: true },
      });

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("Staff activated");
      });
    });

    it("toasts deactivated when flipping active off", async () => {
      queryClient.setQueryData<Staff[]>(staffKeys.list(), [
        makeStaff({ id: "t-1", isActive: true }),
      ]);

      mockUpdateStaff.mockResolvedValue(makeStaff({ id: "t-1", isActive: false }));

      const { result } = renderHook(() => useToggleStaffActive(), { wrapper });
      await result.current.mutateAsync({ id: "t-1", isActive: false });

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("Staff deactivated");
      });
    });

    it("rolls back on error", async () => {
      const snapshot = [makeStaff({ id: "t-1", isActive: true })];
      queryClient.setQueryData<Staff[]>(staffKeys.list(), snapshot);

      mockUpdateStaff.mockRejectedValue(new Error("toggle failed"));

      const { result } = renderHook(() => useToggleStaffActive(), { wrapper });

      await expect(
        result.current.mutateAsync({ id: "t-1", isActive: false })
      ).rejects.toThrow("toggle failed");

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("toggle failed");
      });
      expect(queryClient.getQueryData<Staff[]>(staffKeys.list())).toEqual(snapshot);
    });
  });
});
