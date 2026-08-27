"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TablePagination } from "@/components/ui/table-pagination";
import { useTablePagination } from "@/hooks/use-table-pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, UserCheck, UserX, Mail, Calendar as CalendarIcon, Send } from "lucide-react";
import { format } from "date-fns";
import type { Staff } from "@/types/staff";
import { ROLE_LABELS_SHORT } from "@/lib/constants/roles";

interface StaffTableProps {
  staffs: Staff[];
  currentUserId?: string;
  onEdit: (staff: Staff) => void;
  onDelete: (staff: Staff) => void;
  onToggleActive: (staff: Staff) => void;
  onResendInvite: (staff: Staff) => void;
}

export function StaffTable({
  staffs,
  currentUserId,
  onEdit,
  onDelete,
  onToggleActive,
  onResendInvite,
}: StaffTableProps) {
  const {
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    paginatedItems: paginatedStaffs,
    startIndex,
    endIndex,
    pageSizeOptions,
  } = useTablePagination(staffs, {
    storageKeyPrefix: "staff",
  });

  const getInitials = (staff: Staff) =>
    `${staff.firstName[0] || ""}${staff.lastName[0] || ""}`.toUpperCase();

  const renderActionMenu = (staff: Staff) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={`Actions for ${staff.firstName} ${staff.lastName}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(staff)}>
          <Edit className="h-4 w-4 mr-2" aria-hidden="true" />
          Edit
        </DropdownMenuItem>
        {!staff.isActive && (
          <DropdownMenuItem onClick={() => onResendInvite(staff)}>
            <Send className="h-4 w-4 mr-2" aria-hidden="true" />
            Resend invite
          </DropdownMenuItem>
        )}
        {staff.id !== currentUserId && (
          <>
            <DropdownMenuItem onClick={() => onToggleActive(staff)}>
              {staff.isActive ? (
                <>
                  <UserX className="h-4 w-4 mr-2" aria-hidden="true" />
                  Deactivate
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" aria-hidden="true" />
                  Activate
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(staff)}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (staffs.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-12 text-center" role="status">
        <p className="text-muted-foreground">No staff members found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* Mobile Card View */}
      <div className="md:hidden divide-y" role="list" aria-label="Staff members list">
        {paginatedStaffs.map((staff) => (
          <article
            key={staff.id}
            className="p-4 space-y-3"
            aria-label={`${staff.firstName} ${staff.lastName}`}
          >
            {/* Header: Avatar, Name, Role, Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-medium ${
                    staff.role === "GENERAL_MANAGER" || staff.role === "MANAGER"
                      ? "bg-navy text-cream"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {getInitials(staff)}
                </div>
                <div>
                  <span className="font-medium text-gray-900 block">
                    {staff.firstName} {staff.lastName}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant={staff.role === "STAFF" ? "secondary" : "default"}
                      className={
                        staff.role === "GENERAL_MANAGER"
                          ? "bg-navy text-cream text-xs"
                          : staff.role === "MANAGER"
                            ? "bg-navy/80 text-cream text-xs"
                            : "text-xs"
                      }
                    >
                      {ROLE_LABELS_SHORT[staff.role]}
                    </Badge>
                    <Badge
                      variant={staff.isActive ? "default" : "secondary"}
                      className={
                        staff.isActive
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs"
                          : "bg-gray-100 text-gray-500 text-xs"
                      }
                    >
                      {staff.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </div>
              {renderActionMenu(staff)}
            </div>

            {/* Details */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" aria-hidden="true" />
                <span className="truncate">{staff.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-gray-400" aria-hidden="true" />
                <span>{format(new Date(staff.createdAt), "MMM dd, yyyy")}</span>
              </div>
              <span className="text-gray-500">
                {staff._count.bookings} booking{staff._count.bookings !== 1 ? "s" : ""}
              </span>
            </div>
          </article>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full" role="table" aria-label="Staff members table">
          <thead>
            <tr className="border-b bg-gray-50/50 text-sm font-medium text-gray-500">
              <th scope="col" className="text-left px-6 py-3">Name</th>
              <th scope="col" className="text-left px-6 py-3">Email</th>
              <th scope="col" className="text-center px-6 py-3">Role</th>
              <th scope="col" className="text-center px-6 py-3">Status</th>
              <th scope="col" className="text-center px-6 py-3">Bookings</th>
              <th scope="col" className="text-center px-6 py-3">Created</th>
              <th scope="col" className="text-center px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {paginatedStaffs.map((staff) => (
              <tr
                key={staff.id}
                className="hover:bg-gray-50/50 transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-medium ${
                        staff.role === "GENERAL_MANAGER" ||
                        staff.role === "MANAGER"
                          ? "bg-navy text-cream"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {getInitials(staff)}
                    </div>
                    <span className="font-medium text-gray-900">
                      {staff.firstName} {staff.lastName}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600">{staff.email}</td>
                <td className="px-6 py-4 text-center">
                  <Badge
                    variant={staff.role === "STAFF" ? "secondary" : "default"}
                    className={
                      staff.role === "GENERAL_MANAGER"
                        ? "bg-navy text-cream"
                        : staff.role === "MANAGER"
                          ? "bg-navy/80 text-cream"
                          : ""
                    }
                  >
                    {ROLE_LABELS_SHORT[staff.role]}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-center">
                  <Badge
                    variant={staff.isActive ? "default" : "secondary"}
                    className={
                      staff.isActive
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                        : "bg-gray-100 text-gray-500"
                    }
                  >
                    {staff.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-center text-gray-600">
                  {staff._count.bookings}
                </td>
                <td className="px-6 py-4 text-center text-gray-600">
                  {format(new Date(staff.createdAt), "MMM dd, yyyy")}
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex justify-center">
                    {renderActionMenu(staff)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={staffs.length}
        startIndex={startIndex}
        endIndex={endIndex}
        itemsPerPage={itemsPerPage}
        pageSizeOptions={pageSizeOptions}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
        itemLabel="staff members"
      />
    </div>
  );
}
