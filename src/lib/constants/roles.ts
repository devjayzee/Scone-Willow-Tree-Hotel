import type { Role } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  GENERAL_MANAGER: "General Manager",
  MANAGER: "Manager",
  STAFF: "Front Desk",
};
