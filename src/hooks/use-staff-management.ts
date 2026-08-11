"use client";

import { useState, useCallback, useMemo } from "react";
import {
  useStaffs,
  useCreateStaff,
  useUpdateStaff,
  useDeleteStaff,
  useToggleStaffActive,
  useResendInvite,
} from "@/hooks/staff";
import type { Staff } from "@/types/staff";
import type { StaffFormData } from "@/components/staff/staff-dialog";

interface UseStaffManagementOptions {
  initialStaffs: Staff[];
  fetchTime?: number;
}

export function useStaffManagement({ initialStaffs, fetchTime }: UseStaffManagementOptions) {
  // TanStack Query hooks
  const { data: staffs = initialStaffs, error: queryError, refetch, isLoading, isFetching } = useStaffs(initialStaffs, fetchTime);
  const createMutation = useCreateStaff();
  const updateMutation = useUpdateStaff();
  const deleteMutation = useDeleteStaff();
  const toggleActiveMutation = useToggleStaffActive();
  const resendInviteMutation = useResendInvite();

  // Dialog state
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Derived state
  const error = queryError?.message || "";
  const isProcessing =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    toggleActiveMutation.isPending;

  // Open create dialog
  const openAddDialog = useCallback(() => {
    setSelectedStaff(null);
    setStaffDialogOpen(true);
  }, []);

  // Open edit dialog
  const openEditDialog = useCallback((staff: Staff) => {
    setSelectedStaff(staff);
    setStaffDialogOpen(true);
  }, []);

  // Open delete confirmation dialog
  const openDeleteDialog = useCallback((staff: Staff) => {
    setSelectedStaff(staff);
    setDeleteDialogOpen(true);
  }, []);

  // Create or update a staff member
  const saveStaff = useCallback(
    async (formData: StaffFormData) => {
      if (selectedStaff) {
        // Update existing staff. Password rotation is deliberately
        // absent from this payload (#188) — rotation happens via the
        // /reset-password flow.
        await updateMutation.mutateAsync({
          id: selectedStaff.id,
          data: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            role: formData.role,
          },
        });
      } else {
        // Create new staff — invite flow, no password sent (#144).
        await createMutation.mutateAsync({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          role: formData.role,
        });
      }

      setStaffDialogOpen(false);
      setSelectedStaff(null);
    },
    [selectedStaff, createMutation, updateMutation]
  );

  // Delete the selected staff member
  const confirmDelete = useCallback(async () => {
    if (!selectedStaff) return;

    try {
      await deleteMutation.mutateAsync(selectedStaff.id);
      setDeleteDialogOpen(false);
      setSelectedStaff(null);
    } catch {
      // Error is handled by the mutation's onError
    }
  }, [selectedStaff, deleteMutation]);

  // Toggle staff active status
  const toggleActive = useCallback(
    async (staff: Staff) => {
      await toggleActiveMutation.mutateAsync({
        id: staff.id,
        isActive: !staff.isActive,
      });
    },
    [toggleActiveMutation]
  );

  // Resend a setup invite to an inactive staff member (#144).
  const resendInvite = useCallback(
    async (staff: Staff) => {
      await resendInviteMutation.mutateAsync(staff.id);
    },
    [resendInviteMutation]
  );

  // Update search query
  const updateSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Filter staffs by search query
  const filteredStaffs = useMemo(() => {
    return staffs.filter(
      (staff) =>
        staff.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [staffs, searchQuery]);

  return {
    // Staff data
    staffs,
    filteredStaffs,
    error,
    isLoading,
    isFetching,

    // Dialog state
    staffDialogOpen,
    deleteDialogOpen,
    selectedStaff,
    isProcessing,

    // Search
    searchQuery,

    // Actions
    fetchStaffs: refetch,
    openAddDialog,
    openEditDialog,
    openDeleteDialog,
    saveStaff,
    confirmDelete,
    toggleActive,
    resendInvite,
    updateSearch,
    setStaffDialogOpen,
    setDeleteDialogOpen,
  };
}
