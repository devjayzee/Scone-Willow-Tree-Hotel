import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { BCRYPT_COST, DUMMY_PASSWORD_HASH } from "@/lib/constants/auth";

// Fail loud at server boot instead of on the first sign-in attempt (#70).
if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET is required — set it in .env");
}

// Per-email login rate limiter. Complements the IP-keyed limiter in
// middleware.ts so that distributed brute-force attempts (many IPs, one
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
      },
      async authorize(credentials) {
        // Security: Use generic error messages to prevent account enumeration
        const invalidCredentialsError = "Invalid email or password";

        if (!credentials?.email || !credentials?.password) {
          throw new Error(invalidCredentialsError);
        }

        // Per-email rate limit — normalize so casing/whitespace variants
        // share one bucket. Blocked attempts return the same generic error
        // as bad credentials so the limit isn't distinguishable via response.
        const limiter = getEmailRateLimiter();
        if (limiter) {
          const emailKey = credentials.email.toLowerCase().trim();
          const { success } = await limiter.limit(emailKey);
          if (!success) {
            throw new Error(invalidCredentialsError);
          }
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
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
      }

      // On subsequent requests, validate tokenVersion against database
      // This ensures sessions are invalidated when password changes
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { tokenVersion: true, isActive: true },
        });

        // Invalidate session if user not found, deactivated, or tokenVersion changed
        if (
          !dbUser ||
          !dbUser.isActive ||
          dbUser.tokenVersion !== token.tokenVersion
        ) {
          // Return empty token to force re-authentication
          return { ...token, id: null };
        }
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
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    // 12h accommodates hotel double/overnight shifts while halving the
    // leaked-token window vs. the previous 24h. updateAge re-signs the
    // JWT once per hour of activity so an active user's session extends
    // through their shift without a mid-shift re-login.
    maxAge: 12 * 60 * 60,
    updateAge: 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
};
