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

