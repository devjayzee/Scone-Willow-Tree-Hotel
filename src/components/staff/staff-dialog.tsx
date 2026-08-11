"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Staff, Role } from "@/types/staff";

// Password rotation is handled by the /reset-password flow (#188) —
// GMs cannot set another user's password directly through the staff
// edit dialog. Create flow issues an email setup invite per #144.

interface StaffFormData {
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
}

interface StaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: Staff | null;
  onSubmit: (data: StaffFormData) => Promise<void>;
  isLoading?: boolean;
}

function generateEmail(firstName: string, lastName: string): string {
  if (!firstName || !lastName) return "";
  const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, "");
  const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, "");
  return `${cleanFirst}.${cleanLast}@sconewillowtree.com`;
}

export function StaffDialog({
  open,
  onOpenChange,
  staff,
  onSubmit,
  isLoading = false,
}: StaffDialogProps) {
  const [formData, setFormData] = useState<StaffFormData>({
    firstName: "",
    lastName: "",
    email: "",
    role: "STAFF",
  });
  const [formError, setFormError] = useState("");

  const isEditing = staff !== null;

  // Reset form when dialog opens/closes or staff changes
  useEffect(() => {
    if (open) {
      if (staff) {
        // Editing existing staff
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Form hydration on dialog open. `key`-prop remount would work but is a larger API change than the audit budget covers.
        setFormData({
          firstName: staff.firstName,
          lastName: staff.lastName,
          email: staff.email,
          role: staff.role,
        });
      } else {
        // Creating new staff — no password collected; invite email carries the setup link (#144).
        setFormData({
          firstName: "",
          lastName: "",
          email: "",
          role: "STAFF",
        });
      }
      setFormError("");
    }
  }, [open, staff]);

  const handleNameChange = (field: "firstName" | "lastName", value: string) => {
    const newFormData = { ...formData, [field]: value };

    // Auto-generate email only when creating new staff
    if (!isEditing) {
      const firstName = field === "firstName" ? value : formData.firstName;
      const lastName = field === "lastName" ? value : formData.lastName;
      newFormData.email = generateEmail(firstName, lastName);
    }

    setFormData(newFormData);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError("");

    try {
      await onSubmit(formData);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-navy">
            {isEditing ? "Edit Staff" : "Add New Staff"}
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

            {!isEditing && (
              <p className="text-xs text-muted-foreground">
                The new staff member will receive an email invite to set their
                own password.
              </p>
            )}

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
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="GENERAL_MANAGER">General Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-navy hover:bg-navy-dark text-cream"
              disabled={isLoading}
            >
              {isLoading
                ? "Saving..."
                : isEditing
                ? "Save Changes"
                : "Add Staff"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type { StaffFormData };
