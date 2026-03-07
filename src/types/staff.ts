import type { Role } from "@prisma/client";

// Re-export Role for convenience
export type { Role };

// Staff type for API responses
export interface Staff {
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

// Staff type without booking count (for simpler contexts)
export interface StaffSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  isActive: boolean;
}

// Input type for creating a staff member
export interface CreateStaffInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role?: Role;
}

// Input type for updating a staff member
export interface UpdateStaffInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  role?: Role;
  isActive?: boolean;
}
