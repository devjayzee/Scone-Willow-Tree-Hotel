import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Protected routes that require GENERAL_MANAGER role
    const managerOnlyPaths = ["/settings/users", "/settings/logs"];

    if (managerOnlyPaths.some((p) => path.startsWith(p))) {
      if (token?.role !== "GENERAL_MANAGER") {
        return NextResponse.redirect(new URL("/bookings", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/bookings/:path*",
    "/rooms/:path*",
    "/calendar/:path*",
    "/reports/:path*",
    "/settings/:path*",
  ],
};
