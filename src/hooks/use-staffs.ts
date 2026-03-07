"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invalidateWithRelated } from "@/lib/query-invalidation";
import type { Staff, Role } from "@/types/staff";

export interface StaffFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: Role;
}

export interface UpdateStaffData {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  role?: Role;
  isActive?: boolean;
}

// Query key factory for staffs
export const staffKeys = {
  all: ["staffs"] as const,
  lists: () => [...staffKeys.all, "list"] as const,
  list: () => [...staffKeys.lists()] as const,
  details: () => [...staffKeys.all, "detail"] as const,
  detail: (id: string) => [...staffKeys.details(), id] as const,
};

// Fetch all staffs
async function fetchStaffs(): Promise<Staff[]> {
  const response = await fetch("/api/staffs");
  if (!response.ok) {
    throw new Error("Failed to fetch staffs");
  }
  return response.json();
}

// Create a staff
async function createStaff(data: StaffFormData): Promise<Staff> {
  const response = await fetch("/api/staffs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to create staff");
  }

  return response.json();
}

// Update a staff
async function updateStaff({
  id,
  data,
}: {
  id: string;
  data: UpdateStaffData;
}): Promise<Staff> {
  const response = await fetch(`/api/staffs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to update staff");
  }

  return response.json();
}

// Delete a staff
async function deleteStaff(id: string): Promise<{ message: string; deactivated?: boolean }> {
  const response = await fetch(`/api/staffs/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to delete staff");
  }

  return response.json();
}

// Hook to fetch all staffs
export function useStaffs(initialData?: Staff[], initialDataUpdatedAt?: number) {
  return useQuery({
    queryKey: staffKeys.list(),
    queryFn: fetchStaffs,
    initialData,
    initialDataUpdatedAt,
    staleTime: 1000 * 60 * 5, // 5 minutes - staff data rarely changes
  });
}

// Hook to create a staff with optimistic update
export function useCreateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createStaff,
    onMutate: async (newStaffData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: staffKeys.list() });

      // Snapshot the previous value
      const previousStaffs = queryClient.getQueryData<Staff[]>(staffKeys.list());

      // Optimistically add the new staff with a temporary ID
      const optimisticStaff: Staff = {
        id: `temp-${Date.now()}`,
        firstName: newStaffData.firstName,
        lastName: newStaffData.lastName,
        email: newStaffData.email,
        role: newStaffData.role,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _count: { bookings: 0 },
      };

      queryClient.setQueryData<Staff[]>(staffKeys.list(), (old) => {
        if (!old) return [optimisticStaff];
        // Insert at the beginning (newest first)
        return [optimisticStaff, ...old];
      });

      // Return context with the previous value
      return { previousStaffs };
    },
    onError: (error: Error, _newStaff, context) => {
      // Rollback to the previous value on error
      if (context?.previousStaffs) {
        queryClient.setQueryData(staffKeys.list(), context.previousStaffs);
      }
      toast.error(error.message);
    },
    onSuccess: () => {
      toast.success("Staff created successfully");
    },
    onSettled: () => {
      // Invalidate staff and all related caches
      invalidateWithRelated(queryClient, "staff");
    },
  });
}

// Hook to update a staff with optimistic update
export function useUpdateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateStaff,
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: staffKeys.list() });

      // Snapshot the previous value
      const previousStaffs = queryClient.getQueryData<Staff[]>(staffKeys.list());

      // Optimistically update the staff
      queryClient.setQueryData<Staff[]>(staffKeys.list(), (old) => {
        if (!old) return old;
        return old.map((staff) =>
          staff.id === id
            ? {
                ...staff,
                firstName: data.firstName ?? staff.firstName,
                lastName: data.lastName ?? staff.lastName,
                email: data.email ?? staff.email,
                role: data.role ?? staff.role,
                isActive: data.isActive ?? staff.isActive,
                updatedAt: new Date().toISOString(),
              }
            : staff
        );
      });

      return { previousStaffs };
    },
    onError: (error: Error, _variables, context) => {
      // Rollback to the previous value on error
      if (context?.previousStaffs) {
        queryClient.setQueryData(staffKeys.list(), context.previousStaffs);
      }
      toast.error(error.message);
    },
    onSettled: () => {
      // Invalidate staff and all related caches
      invalidateWithRelated(queryClient, "staff");
    },
  });
}

// Hook to delete a staff with optimistic update
export function useDeleteStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteStaff,
    onMutate: async (deletedId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: staffKeys.list() });

      // Snapshot the previous value
      const previousStaffs = queryClient.getQueryData<Staff[]>(staffKeys.list());

      // Optimistically remove the staff
      queryClient.setQueryData<Staff[]>(staffKeys.list(), (old) => {
        if (!old) return old;
        return old.filter((staff) => staff.id !== deletedId);
      });

      return { previousStaffs };
    },
    onError: (error: Error, _deletedId, context) => {
      // Rollback to the previous value on error
      if (context?.previousStaffs) {
        queryClient.setQueryData(staffKeys.list(), context.previousStaffs);
      }
      toast.error(error.message);
    },
    onSuccess: (result) => {
      if (result.deactivated) {
        toast.success("Staff deactivated (has active bookings)");
      } else {
        toast.success("Staff deleted successfully");
      }
    },
    onSettled: () => {
      // Invalidate staff and all related caches
      invalidateWithRelated(queryClient, "staff");
    },
  });
}

// Hook to toggle staff active status
export function useToggleStaffActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return updateStaff({ id, data: { isActive } });
    },
    onMutate: async ({ id, isActive }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: staffKeys.list() });

      // Snapshot the previous value
      const previousStaffs = queryClient.getQueryData<Staff[]>(staffKeys.list());

      // Optimistically toggle the active status
      queryClient.setQueryData<Staff[]>(staffKeys.list(), (old) => {
        if (!old) return old;
        return old.map((staff) =>
          staff.id === id
            ? { ...staff, isActive, updatedAt: new Date().toISOString() }
            : staff
        );
      });

      return { previousStaffs };
    },
    onError: (error: Error, _variables, context) => {
      // Rollback to the previous value on error
      if (context?.previousStaffs) {
        queryClient.setQueryData(staffKeys.list(), context.previousStaffs);
      }
      toast.error(error.message);
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.isActive ? "Staff activated" : "Staff deactivated");
    },
    onSettled: () => {
      // Invalidate staff and all related caches
      invalidateWithRelated(queryClient, "staff");
    },
  });
}
