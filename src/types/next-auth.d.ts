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
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    /** User ID. Null when session is invalidated (password change, deactivation). */
    id: string | null;
    role: string;
    firstName: string;
    tokenVersion: number;
  }
}
