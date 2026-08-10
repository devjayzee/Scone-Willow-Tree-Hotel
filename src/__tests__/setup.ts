import "@testing-library/jest-dom";
import { vi } from "vitest";

// auth.ts asserts NEXTAUTH_SECRET at module scope (#70). Any test that
// imports `authOptions` directly or transitively needs a truthy value; the
// content doesn't matter — unit tests don't verify real JWTs.
process.env.NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET || "test-nextauth-secret-not-used-in-real-crypto";

// email/app-url.ts asserts NEXTAUTH_URL at module scope (#143). Same
// pattern as NEXTAUTH_SECRET above — tests that transitively import an
// email template need a truthy value. The app-url test itself deletes
// this in a beforeEach so it can exercise the missing-env branch.
process.env.NEXTAUTH_URL =
  process.env.NEXTAUTH_URL || "http://localhost:3000";

// Mock next-auth
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: vi.fn(() => ({
    data: null,
    status: "unauthenticated",
  })),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));
