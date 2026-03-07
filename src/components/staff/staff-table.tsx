"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { format } from "date-fns";
import type { Staff } from "@/types/staff";

interface StaffTableProps {
  staffs: Staff[];
  currentUserId?: string;
  onEdit: (staff: Staff) => void;
  onDelete: (staff: Staff) => void;
  onToggleActive: (staff: Staff) => void;
}

export function StaffTable({
  staffs,
  currentUserId,
  onEdit,
  onDelete,
  onToggleActive,
}: StaffTableProps) {
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <table className="w-full table-fixed">
        <thead>
          <tr className="border-b bg-gray-50/50 text-sm font-medium text-gray-500">
            <th className="text-center px-6 py-3 w-[20%]">Name</th>
            <th className="text-center px-6 py-3 w-[25%]">Email</th>
            <th className="text-center px-6 py-3 w-[10%]">Role</th>
            <th className="text-center px-6 py-3 w-[10%]">Status</th>
            <th className="text-center px-6 py-3 w-[10%]">Bookings</th>
            <th className="text-center px-6 py-3 w-[15%]">Created</th>
            <th className="text-center px-6 py-3 w-[10%]">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {staffs.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                No staff members found
              </td>
            </tr>
          ) : (
            staffs.map((staff) => {
              const initials = `${staff.firstName[0] || ""}${staff.lastName[0] || ""}`.toUpperCase();
              return (
                <tr key={staff.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        staff.role === "GENERAL_MANAGER"
                          ? "bg-navy text-cream"
                          : "bg-gray-200 text-gray-600"
                      }`}>
                        {initials}
                      </div>
                      <span className="font-medium text-gray-900">{staff.firstName} {staff.lastName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600">{staff.email}</td>
                  <td className="px-6 py-4 text-center">
                    <Badge
                      variant={staff.role === "GENERAL_MANAGER" ? "default" : "secondary"}
                      className={
                        staff.role === "GENERAL_MANAGER"
                          ? "bg-navy text-cream"
                          : ""
                      }
                    >
                      {staff.role === "GENERAL_MANAGER" ? "Manager" : "Staff"}
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(staff)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {staff.id !== currentUserId && (
                            <>
                              <DropdownMenuItem onClick={() => onToggleActive(staff)}>
                                {staff.isActive ? (
                                  <>
                                    <UserX className="h-4 w-4 mr-2" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="h-4 w-4 mr-2" />
                                    Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onDelete(staff)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <div className="px-6 py-3 border-t bg-gray-50/30 text-sm text-gray-500">
        Showing {staffs.length} staff member
        {staffs.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
