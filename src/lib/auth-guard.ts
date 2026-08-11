import { getServerSession, type Session } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

// Server-side session gate for dashboard pages and layouts (#181).
//
// Middleware's withAuth uses getToken() internally, which decodes the JWE
// but does NOT invoke the NextAuth jwt callback — so the revocation /
// expiry logic in src/lib/auth.ts never runs at the middleware layer.
// This helper forces getServerSession, which DOES run jwt, so a
// deactivated or expired session gets kicked out before any RSC data
// fetch. Middleware stays as a fast-path UX redirect.
export async function requireSession(
  role?: string | readonly string[],
): Promise<Session> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (role !== undefined) {
    const allowed = typeof role === "string" ? [role] : role;
    if (!allowed.includes(session.user.role)) {
      redirect("/bookings");
    }
  }

  return session;
}
