import type { Role } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  GENERAL_MANAGER: "General Manager",
  MANAGER: "Manager",
  STAFF: "Staff",
};

/** Abbreviated form for tight table/badge layouts. */
export const ROLE_LABELS_SHORT: Record<Role, string> = {
  GENERAL_MANAGER: "GM",
  MANAGER: "Manager",
  STAFF: "Staff",
};
