"use client";

import { useState, useEffect, useMemo } from "react";
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
import { PasswordStrengthIndicator } from "@/components/ui/password-strength-indicator";
import { RefreshCw } from "lucide-react";
import { checkPasswordStrength, generatePassword } from "@/lib/validations/password";
import type { Staff, Role } from "@/types/staff";

interface StaffFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
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
    password: "",
    role: "STAFF",
  });
  const [formError, setFormError] = useState("");

  const isEditing = staff !== null;

  // Check if password meets requirements
  const passwordStrength = useMemo(
    () => checkPasswordStrength(formData.password),
    [formData.password]
  );

  const isPasswordValid = isEditing
    ? formData.password === "" || passwordStrength.isValid
    : passwordStrength.isValid;

  // Reset form when dialog opens/closes or staff changes
  useEffect(() => {
    if (open) {
      if (staff) {
        // Editing existing staff
        setFormData({
          firstName: staff.firstName,
          lastName: staff.lastName,
          email: staff.email,
          password: "",
          role: staff.role,
        });
      } else {
        // Creating new staff
        setFormData({
          firstName: "",
          lastName: "",
          email: "",
          password: generatePassword(),
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

    // Validate password strength before submitting
    if (!isPasswordValid) {
      setFormError("Password does not meet security requirements");
      return;
    }

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

            <div className="space-y-2">
              <Label htmlFor="password">
                Password {isEditing ? "(leave blank to keep current)" : "*"}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="password"
                  type={formData.password ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder={isEditing ? "••••••••" : ""}
                  required={!isEditing}
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setFormData({ ...formData, password: generatePassword() })
                  }
                  title="Generate new password"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              {/* Password strength indicator */}
              <PasswordStrengthIndicator password={formData.password} />

              {formData.password && passwordStrength.isValid && (
                <p className="text-xs text-muted-foreground mt-2">
                  {isEditing
                    ? "New password generated. Share this with the staff member."
                    : "Auto-generated password. Share this with the staff member."}
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
              disabled={isLoading || !isPasswordValid}
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
