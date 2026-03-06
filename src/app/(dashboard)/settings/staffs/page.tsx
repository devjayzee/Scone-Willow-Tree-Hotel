"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";

type Role = "GENERAL_MANAGER" | "STAFF";

interface Staff {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    bookings: number;
  };
}

function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="h-8 w-44 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 w-56 bg-gray-200 rounded"></div>
        </div>
        <div className="h-10 w-28 bg-gray-200 rounded"></div>
      </div>

      {/* Search Skeleton */}
      <div className="h-10 w-80 bg-gray-200 rounded"></div>

      {/* Table Skeleton */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50/50 text-sm font-medium text-gray-500">
              <th className="text-left px-6 py-3">Name</th>
              <th className="text-left px-6 py-3">Email</th>
              <th className="text-left px-6 py-3">Role</th>
              <th className="text-left px-6 py-3">Status</th>
              <th className="text-left px-6 py-3">Bookings</th>
              <th className="text-left px-6 py-3">Created</th>
              <th className="text-right px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                    <div className="h-4 w-32 bg-gray-200 rounded"></div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 w-48 bg-gray-200 rounded"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-6 w-16 bg-gray-200 rounded-full"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-6 w-14 bg-gray-200 rounded-full"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 w-8 bg-gray-200 rounded"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 w-24 bg-gray-200 rounded"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end">
                    <div className="h-8 w-8 bg-gray-200 rounded"></div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-6 py-3 border-t bg-gray-50/30">
          <div className="h-4 w-36 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );
}

export default function StaffsPage() {
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "STAFF" as Role,
  });
  const [formError, setFormError] = useState("");

  const fetchStaffs = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/staffs");
      if (!response.ok) throw new Error("Failed to fetch staffs");
      const data = await response.json();
      setStaffs(data);
      setError("");
    } catch {
      setError("Failed to load staff members");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaffs();
  }, [fetchStaffs]);

  // Delay for skeleton loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      role: "STAFF",
    });
    setFormError("");
    setSelectedStaff(null);
  };

  const generateEmail = (firstName: string, lastName: string) => {
    if (!firstName || !lastName) return "";
    const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, "");
    const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, "");
    return `${cleanFirst}.${cleanLast}@sconewillowtree.com`;
  };

  const generatePassword = () => {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const all = uppercase + lowercase + numbers;

    // Ensure at least one of each type for a stronger password
    let password = "";
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];

    // Fill remaining characters (total 8 characters for good security)
    for (let i = 0; i < 5; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }

    // Shuffle the password
    return password.split("").sort(() => Math.random() - 0.5).join("");
  };

  const handleNameChange = (field: "firstName" | "lastName", value: string) => {
    const newFormData = { ...formData, [field]: value };

    // Auto-generate email only when creating new staff (not editing)
    if (!selectedStaff) {
      const firstName = field === "firstName" ? value : formData.firstName;
      const lastName = field === "lastName" ? value : formData.lastName;
      newFormData.email = generateEmail(firstName, lastName);
    }

    setFormData(newFormData);
  };

  const openCreateDialog = () => {
    resetForm();
    // Auto-generate password for new staff
    setFormData((prev) => ({ ...prev, password: generatePassword() }));
    setDialogOpen(true);
  };

  const openEditDialog = (staff: Staff) => {
    setSelectedStaff(staff);
    setFormData({
      firstName: staff.firstName,
      lastName: staff.lastName,
      email: staff.email,
      password: "",
      role: staff.role,
    });
    setFormError("");
    setDialogOpen(true);
  };

  const openDeleteDialog = (staff: Staff) => {
    setSelectedStaff(staff);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setIsProcessing(true);

    try {
      const url = selectedStaff
        ? `/api/staffs/${selectedStaff.id}`
        : "/api/staffs";
      const method = selectedStaff ? "PUT" : "POST";

      const body: Record<string, string> = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        role: formData.role,
      };

      // Only include password if provided (for edit) or always for create
      if (!selectedStaff || formData.password) {
        body.password = formData.password;
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save staff");
      }

      toast.success(selectedStaff ? "Staff updated successfully" : "Staff created successfully");
      setDialogOpen(false);
      resetForm();
      await fetchStaffs();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedStaff) return;

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/staffs/${selectedStaff.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete staff");
      }

      toast.success("Staff deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedStaff(null);
      await fetchStaffs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete staff");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleActive = async (staff: Staff) => {
    try {
      const response = await fetch(`/api/staffs/${staff.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !staff.isActive }),
      });

      if (!response.ok) {
        throw new Error("Failed to update staff status");
      }

      toast.success(staff.isActive ? "Staff deactivated" : "Staff activated");
      await fetchStaffs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update staff");
    }
  };

  const filteredStaffs = staffs.filter(
    (staff) =>
      staff.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Show skeleton while loading
  if (!mounted || isLoading) {
    return <PageSkeleton />;
  }

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
          onClick={openCreateDialog}
          className="bg-navy hover:bg-navy-dark text-cream"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Staff
        </Button>
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search staff..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Staff Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50/50 text-sm font-medium text-gray-500">
              <th className="text-left px-6 py-3">Name</th>
              <th className="text-left px-6 py-3">Email</th>
              <th className="text-left px-6 py-3">Role</th>
              <th className="text-left px-6 py-3">Status</th>
              <th className="text-left px-6 py-3">Bookings</th>
              <th className="text-left px-6 py-3">Created</th>
              <th className="text-right px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredStaffs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                  No staff members found
                </td>
              </tr>
            ) : (
              filteredStaffs.map((staff) => {
                const initials = `${staff.firstName[0] || ""}${staff.lastName[0] || ""}`.toUpperCase();
                return (
                  <tr key={staff.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
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
                    <td className="px-6 py-4 text-gray-600">{staff.email}</td>
                    <td className="px-6 py-4">
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
                    <td className="px-6 py-4">
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
                    <td className="px-6 py-4 text-gray-600">
                      {staff._count.bookings}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {format(new Date(staff.createdAt), "MMM dd, yyyy")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(staff)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleActive(staff)}>
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
                              onClick={() => openDeleteDialog(staff)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
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
          Showing {filteredStaffs.length} staff member
          {filteredStaffs.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-navy">
              {selectedStaff ? "Edit Staff" : "Add New Staff"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            {formError && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-4">
                {formError}
              </div>
            )}

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => handleNameChange("firstName", e.target.value)}
                    placeholder="John"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => handleNameChange("lastName", e.target.value)}
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="john.doe@sconewillowtree.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  Password {selectedStaff ? "(leave blank to keep current)" : "*"}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="password"
                    type={formData.password && !selectedStaff ? "text" : formData.password ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder={selectedStaff ? "••••••••" : ""}
                    required={!selectedStaff}
                    minLength={6}
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setFormData({ ...formData, password: generatePassword() })}
                    title="Generate new password"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                {formData.password && (
                  <p className="text-xs text-muted-foreground">
                    {selectedStaff ? "New password generated. Share this with the staff member." : "Auto-generated password. Share this with the staff member."}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: Role) =>
                    setFormData({ ...formData, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STAFF">Staff</SelectItem>
                    <SelectItem value="GENERAL_MANAGER">General Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-navy hover:bg-navy-dark text-cream"
                disabled={isProcessing}
              >
                {isProcessing
                  ? "Saving..."
                  : selectedStaff
                  ? "Save Changes"
                  : "Add Staff"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Staff?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-medium text-gray-900">{selectedStaff?.firstName} {selectedStaff?.lastName}</span>? This action cannot be undone.
              {selectedStaff && selectedStaff._count.bookings > 0 && (
                <span className="block mt-2 text-amber-600">
                  Note: This staff member has {selectedStaff._count.bookings} booking(s) and will be deactivated instead of deleted.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isProcessing}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isProcessing ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
