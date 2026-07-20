"use client";

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

export async function fetchStaffs(): Promise<Staff[]> {
  const response = await fetch("/api/staffs");
  if (!response.ok) {
    throw new Error("Failed to fetch staffs");
  }
  return response.json();
}

export async function createStaff(data: StaffFormData): Promise<Staff> {
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

export async function updateStaff({
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

export async function deleteStaff(
  id: string
): Promise<{ message: string; deactivated?: boolean }> {
  const response = await fetch(`/api/staffs/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to delete staff");
  }

  return response.json();
}
