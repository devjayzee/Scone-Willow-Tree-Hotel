import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      firstName: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: string;
    firstName: string;
    tokenVersion: number;
    /**
     * Present only on the initial-sign-in projection returned by
     * authorize(). Reflects the "Remember this device" checkbox.
     */
    remember?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    /** User ID. Null when session is invalidated (password change, deactivation). */
    id: string | null;
    role: string;
    firstName: string;
    tokenVersion: number;
    /** Persisted remember-device choice. */
    remember?: boolean;
    /**
     * Per-login expiry in seconds since epoch. Missing = refused
     * (pre-2026-08-10 token). Kept optional so decoded old tokens type-check.
     */
    expiresAt?: number;
  }
}
