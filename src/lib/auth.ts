import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import {
  BCRYPT_COST,
  DUMMY_PASSWORD_HASH,
  INVALID_CREDENTIALS,
  SIGN_IN_PAUSED,
  SESSION_MAX_AGE_REMEMBER,
  SESSION_MAX_AGE_STANDARD,
  SESSION_UPDATE_AGE,
} from "@/lib/constants/auth";
import { normalizeEmail } from "@/lib/validations/email";
import { consumeLoginAttempt } from "@/lib/services/rate-limit-service";
import {
  DEVICE_COOKIE_NAME,
  DEVICE_COOKIE_OPTIONS,
  findTrustedDevice,
  issueDeviceCookie,
} from "@/lib/utils/device-cookie";
import { getClientIp } from "@/lib/utils/get-client-ip";
import { logger } from "@/lib/logger";

// Fail loud at server boot instead of on the first sign-in attempt.
if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET is required — set it in .env");
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        // "1" from the "Remember this device" checkbox; anything else is
        // treated as unchecked. NextAuth stringifies all credentials.
        remember: { label: "Remember", type: "text" },
      },
      async authorize(credentials, req) {
        // Security: Use generic error messages to prevent account enumeration
        if (!credentials?.email || !credentials?.password) {
          throw new Error(INVALID_CREDENTIALS);
        }

        // Normalize once — this MUST match how emails are stored (staff
        // creation schema) and looked up elsewhere (forgot-password), or
        // mixed-case input silently misses the row.
        const email = normalizeEmail(credentials.email);

        // Login rate limits live here, not in the proxy, because a browser
        // holding a trusted-device cookie for this email (not revoked) skips
        // the IP and email buckets and spends the shared per-account trusted bucket instead. The check
        // runs before the user lookup, so the refusal is identical for
        // emails with and without accounts.
        const jar = await cookies();
        const oldDeviceCookie = jar.get(DEVICE_COOKIE_NAME)?.value;
        const deviceIat = findTrustedDevice(oldDeviceCookie, email)?.iat ?? null;
        // NextAuth hands over a plain headers record; Headers accepts it.
        const ip = getClientIp({ headers: new Headers(req?.headers ?? {}) });
        if (!(await consumeLoginAttempt({ email, ip, deviceIat }))) {
          throw new Error(SIGN_IN_PAUSED);
        }

        // Taken before the lookup, so only a sign-in that reads the row
        // between the revoke and the commit can mint a newer iat.
        const attemptSec = Math.floor(Date.now() / 1000);
        const user = await prisma.user.findUnique({
          where: { email },
        });

        // Run a dummy compare against the same-cost hash on the two
        // short-circuit branches so the failure paths cost the same wall
        // time as the wrong-password path.
        if (!user || !user.isActive) {
          await bcrypt.compare(credentials.password, DUMMY_PASSWORD_HASH);
          throw new Error(INVALID_CREDENTIALS);
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.password,
        );

        if (!isValidPassword) {
          throw new Error(INVALID_CREDENTIALS);
        }

        // Transparent bcrypt-cost upgrade: if the stored hash was made
        // at a lower cost than the current baseline, re-hash on successful
        // login and write back. Keeps the timing equalization tight for
        // old users too. Do NOT increment tokenVersion — this is an
        // algorithm upgrade, not a credential change; existing JWTs stay valid.
        if (bcrypt.getRounds(user.password) < BCRYPT_COST) {
          const rehashed = await bcrypt.hash(credentials.password, BCRYPT_COST);
          await prisma.user.update({
            where: { id: user.id },
            data: { password: rehashed },
          });
        }

        // Mark this browser as trusted for this email. A cookie failure must
        // never block a correct sign-in.
        try {
          jar.set(
            DEVICE_COOKIE_NAME,
            issueDeviceCookie(oldDeviceCookie, email, attemptSec),
            DEVICE_COOKIE_OPTIONS,
          );
        } catch (error) {
          logger.warn("could not set trusted-device cookie", {
            error: error instanceof Error ? error.message : String(error),
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          firstName: user.firstName,
          role: user.role,
          tokenVersion: user.tokenVersion,
          remember: credentials.remember === "1",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign in - store user data in token
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.firstName = user.firstName;
        token.tokenVersion = user.tokenVersion;
        token.remember = user.remember ?? false;
        token.expiresAt =
          Math.floor(Date.now() / 1000) +
          (user.remember ? SESSION_MAX_AGE_REMEMBER : SESSION_MAX_AGE_STANDARD);
      }

      // Custom per-login expiry. The session cookie's own maxAge is
      // set to the remember-me ceiling so both flows share one cookie
      // config; the actual per-user duration is enforced here. Legacy
      // tokens without expiresAt fall through to NextAuth's own maxAge.
      if (
        typeof token.expiresAt === "number" &&
        Math.floor(Date.now() / 1000) > token.expiresAt
      ) {
        return { ...token, id: null };
      }

      // On subsequent requests, re-read the user row. Two jobs:
      //   1. tokenVersion / isActive gate — invalidate the session on
      //      password rotation or deactivation.
      //   2. Rehydrate mutable fields (role, firstName) so the JWT is
      //      never trusted as a cache for anything that can be changed
      //      in the DB. This is why writers to `role` / `firstName` do
      //      NOT need to bump tokenVersion: the next session poll picks
      //      up the change automatically. Adding a new mutable field
      //      that the app displays or authorizes against? Widen the
      //      select and the assignment below — do not reach for
      //      tokenVersion.
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: {
            tokenVersion: true,
            isActive: true,
            role: true,
            firstName: true,
          },
        });

        if (
          !dbUser ||
          !dbUser.isActive ||
          dbUser.tokenVersion !== token.tokenVersion
        ) {
          return { ...token, id: null };
        }

        token.role = dbUser.role;
        token.firstName = dbUser.firstName;
      }

      return token;
    },
    async session({ session, token }) {
      // If token was invalidated (password changed), clear the session user
      if (!token.id) {
        // Return session with empty user to trigger re-authentication
        return { ...session, user: undefined } as unknown as typeof session;
      }

      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.firstName = token.firstName;
      }

      // Reflect the per-user expiry so the client sees the real
      // remaining lifetime instead of the cookie's 30-day ceiling.
      if (typeof token.expiresAt === "number") {
        session.expires = new Date(token.expiresAt * 1000).toISOString();
      }

      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    // Cookie-lifetime ceiling — the remember-me window. The
    // actual per-user duration (12h vs 30d) is enforced inside the jwt
    // callback via token.expiresAt, so an unchecked-remember session
    // becomes an invalid-token cookie after 12h even though the cookie
    // itself sticks around until the ceiling. updateAge re-signs the
    // JWT once per hour of activity; custom fields survive re-signing.
    maxAge: SESSION_MAX_AGE_REMEMBER,
    updateAge: SESSION_UPDATE_AGE,
  },
  secret: process.env.NEXTAUTH_SECRET,
};
