"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, RefreshCw } from "lucide-react";
import { StaffTable } from "@/components/staff/staff-table";
import { StaffTableSkeleton } from "@/components/staff/staff-table-skeleton";
import { StaffDialog } from "@/components/staff/staff-dialog";
import { DeleteStaffDialog } from "@/components/staff/delete-staff-dialog";
import { useStaffManagement } from "@/hooks/use-staff-management";
import type { Staff } from "@/types/staff";

interface StaffsClientProps {
  initialStaffs: Staff[];
  currentUserId?: string;
  fetchTime?: number;
}

export function StaffsClient({ initialStaffs, currentUserId, fetchTime }: StaffsClientProps) {
  const {
    filteredStaffs,
    error,
    isLoading,
    isFetching,
    staffDialogOpen,
    deleteDialogOpen,
    selectedStaff,
    isProcessing,
    searchQuery,
    fetchStaffs,
    openAddDialog,
    openEditDialog,
    openDeleteDialog,
    saveStaff,
    confirmDelete,
    toggleActive,
    updateSearch,
    setStaffDialogOpen,
    setDeleteDialogOpen,
  } = useStaffManagement({ initialStaffs, fetchTime });

  const handleDialogClose = (open: boolean) => {
    setStaffDialogOpen(open);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Staff Management</h1>
          <p className="text-muted-foreground">
            Manage staff accounts and permissions
          </p>
        </div>
        <Button
          onClick={openAddDialog}
          className="bg-navy hover:bg-navy-dark text-cream"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Staff
        </Button>
      </div>

      {/* Search and Refresh */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search staff..."
            value={searchQuery}
            onChange={(e) => updateSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => fetchStaffs()}
          disabled={isFetching}
          title="Refresh staff"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          {error}
        </div>
      )}

      {isLoading ? (
        <StaffTableSkeleton />
      ) : (
        <StaffTable
          staffs={filteredStaffs}
          currentUserId={currentUserId}
          onEdit={openEditDialog}
          onDelete={openDeleteDialog}
          onToggleActive={toggleActive}
        />
      )}

      <StaffDialog
        open={staffDialogOpen}
        onOpenChange={handleDialogClose}
        staff={selectedStaff}
        onSubmit={saveStaff}
        isLoading={isProcessing}
      />

      <DeleteStaffDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        staff={selectedStaff}
        onConfirm={confirmDelete}
        isLoading={isProcessing}
      />
    </div>
  );
}
