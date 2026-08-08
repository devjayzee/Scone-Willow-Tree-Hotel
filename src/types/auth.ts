import type { Role } from "@prisma/client";

export interface ResolvedInviteResponse {
  email: string;
  firstName: string;
  role: Role;
}

export interface AuthActionResponse {
  ok: true;
}
