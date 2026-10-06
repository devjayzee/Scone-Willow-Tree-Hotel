import { getServerSession, type Session } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

// Server-side session gate for dashboard pages and layouts.
//
// The proxy's withAuth uses getToken() internally, which decodes the JWE
// but does NOT invoke the NextAuth jwt callback. The proxy copies the
// expiry rule, but revocation (tokenVersion / isActive) needs a DB read it
// does not do. This helper forces getServerSession, which DOES run jwt, so
// a deactivated or expired session gets kicked out before any RSC data
// fetch. The proxy stays as a fast-path UX redirect.
//
// The redirect carries ?session=expired so the proxy does not bounce a
// still-decodable cookie straight back to /bookings (redirect loop). Any
// redirect to /login caused by a dead session must carry it.
export async function requireSession(
  role?: string | readonly string[],
): Promise<Session> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?session=expired");
  }

  if (role !== undefined) {
    const allowed = typeof role === "string" ? [role] : role;
    if (!allowed.includes(session.user.role)) {
      redirect("/bookings");
    }
  }

  return session;
}
