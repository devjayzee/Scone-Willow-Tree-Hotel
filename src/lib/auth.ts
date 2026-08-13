import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  BCRYPT_COST,
  DUMMY_PASSWORD_HASH,
  SESSION_MAX_AGE_REMEMBER,
  SESSION_MAX_AGE_STANDARD,
} from "@/lib/constants/auth";
import { normalizeEmail } from "@/lib/validations/email";

// Fail loud at server boot instead of on the first sign-in attempt (#70).
if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET is required — set it in .env");
}

// Per-email login rate limiter. Complements the IP-keyed limiter in
// proxy.ts so that distributed brute-force attempts (many IPs, one
// account) still hit a per-account cap.
let emailRateLimiter: Ratelimit | null = null;

function getEmailRateLimiter(): Ratelimit | null {
  if (
    !emailRateLimiter &&
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    emailRateLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "15 m"),
      analytics: true,
      prefix: "ratelimit:login-email",
    });
  }
  return emailRateLimiter;
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
      async authorize(credentials) {
        // Security: Use generic error messages to prevent account enumeration
        const invalidCredentialsError = "Invalid email or password";

        if (!credentials?.email || !credentials?.password) {
          throw new Error(invalidCredentialsError);
        }

        // Normalize once — this MUST match how emails are stored (staff
        // creation schema) and looked up elsewhere (forgot-password), or
        // mixed-case input silently misses the row.
        const email = normalizeEmail(credentials.email);

        // Per-email rate limit — the normalized value is the bucket key
        // so casing/whitespace variants share one budget. Blocked attempts
        // return the same generic error as bad credentials so the limit
        // isn't distinguishable via response.
        const limiter = getEmailRateLimiter();
        if (limiter) {
          const { success } = await limiter.limit(email);
          if (!success) {
            throw new Error(invalidCredentialsError);
          }
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        // Run a dummy compare against the same-cost hash on the two
        // short-circuit branches so the failure paths cost the same wall
        // time as the wrong-password path (#66).
        if (!user || !user.isActive) {
          await bcrypt.compare(credentials.password, DUMMY_PASSWORD_HASH);
          throw new Error(invalidCredentialsError);
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.password,
        );

        if (!isValidPassword) {
          throw new Error(invalidCredentialsError);
        }

        // Transparent bcrypt-cost upgrade (#71): if the stored hash was made
        // at a lower cost than the current baseline, re-hash on successful
        // login and write back. Keeps the #66 timing equalization tight for
        // old users too. Do NOT increment tokenVersion — this is an
        // algorithm upgrade, not a credential change; existing JWTs stay valid.
        if (bcrypt.getRounds(user.password) < BCRYPT_COST) {
          const rehashed = await bcrypt.hash(credentials.password, BCRYPT_COST);
          await prisma.user.update({
            where: { id: user.id },
            data: { password: rehashed },
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

      // Custom per-login expiry (#145). The session cookie's own maxAge is
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

      // Reflect the per-user expiry (#145) so the client sees the real
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
    // Cookie-lifetime ceiling — the remember-me window (#145). The
    // actual per-user duration (12h vs 30d) is enforced inside the jwt
    // callback via token.expiresAt, so an unchecked-remember session
    // becomes an invalid-token cookie after 12h even though the cookie
    // itself sticks around until the ceiling. updateAge re-signs the
    // JWT once per hour of activity; custom fields survive re-signing.
    maxAge: SESSION_MAX_AGE_REMEMBER,
    updateAge: 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
};
