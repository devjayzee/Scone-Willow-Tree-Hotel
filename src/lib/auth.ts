import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

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

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          throw new Error(invalidCredentialsError);
        }

        // Deactivated accounts get the same error as invalid credentials
        // to prevent attackers from discovering valid email addresses
        if (!user.isActive) {
          throw new Error(invalidCredentialsError);
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.password,
        );

        if (!isValidPassword) {
          throw new Error(invalidCredentialsError);
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
          where: { id: token.id as string },
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
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.firstName = token.firstName as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
};
