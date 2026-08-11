"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invalidateWithRelated } from "@/lib/query-invalidation";
import type { Staff } from "@/types/staff";
import {
  createStaff,
  deleteStaff,
  resendInvite,
  updateStaff,
} from "./staff-api";
import { staffKeys } from "./staff-keys";

export function useCreateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createStaff,
    onMutate: async (newStaffData) => {
      await queryClient.cancelQueries({ queryKey: staffKeys.list() });

      const previousStaffs = queryClient.getQueryData<Staff[]>(staffKeys.list());

      const optimisticStaff: Staff = {
        id: `temp-${Date.now()}`,
        firstName: newStaffData.firstName,
        lastName: newStaffData.lastName,
        email: newStaffData.email,
        role: newStaffData.role,
        // Invited users are inactive until they set a password (#144).
        isActive: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _count: { bookings: 0 },
      };

      queryClient.setQueryData<Staff[]>(staffKeys.list(), (old) => {
        if (!old) return [optimisticStaff];
        return [optimisticStaff, ...old];
      });

      return { previousStaffs };
    },
    onError: (error: Error, _newStaff, context) => {
      if (context?.previousStaffs) {
        queryClient.setQueryData(staffKeys.list(), context.previousStaffs);
      }
      toast.error(error.message);
    },
    onSuccess: (staff) => {
      toast.success(`Invite sent to ${staff.email}`);
    },
    onSettled: () => {
      invalidateWithRelated(queryClient, "staffs");
    },
  });
}

export function useResendInvite() {
  return useMutation({
    mutationFn: resendInvite,
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSuccess: () => {
      toast.success("Invite resent");
    },
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateStaff,
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: staffKeys.list() });

      const previousStaffs = queryClient.getQueryData<Staff[]>(staffKeys.list());

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
      if (context?.previousStaffs) {
        queryClient.setQueryData(staffKeys.list(), context.previousStaffs);
      }
      toast.error(error.message);
    },
    onSettled: () => {
      invalidateWithRelated(queryClient, "staffs");
    },
  });
}

export function useDeleteStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteStaff,
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: staffKeys.list() });

      const previousStaffs = queryClient.getQueryData<Staff[]>(staffKeys.list());

      queryClient.setQueryData<Staff[]>(staffKeys.list(), (old) => {
        if (!old) return old;
        return old.filter((staff) => staff.id !== deletedId);
      });

      return { previousStaffs };
    },
    onError: (error: Error, _deletedId, context) => {
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
      invalidateWithRelated(queryClient, "staffs");
    },
  });
}

export function useToggleStaffActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return updateStaff({ id, data: { isActive } });
    },
    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({ queryKey: staffKeys.list() });

      const previousStaffs = queryClient.getQueryData<Staff[]>(staffKeys.list());

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
      if (context?.previousStaffs) {
        queryClient.setQueryData(staffKeys.list(), context.previousStaffs);
      }
      toast.error(error.message);
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.isActive ? "Staff activated" : "Staff deactivated");
    },
    onSettled: () => {
      invalidateWithRelated(queryClient, "staffs");
    },
  });
}
