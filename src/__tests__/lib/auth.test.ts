/* eslint-disable @typescript-eslint/no-explicit-any --
   NextAuth callback param types (JWTCallbackArgs, SessionCallbackArgs) are
   large generic unions that don't add value in test fixtures. Callback args
   are cast to `any` throughout this file for readability. */
import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

// Mock Prisma
const mockFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

// Mock bcrypt
vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
  },
}));

// Mock Upstash — the per-email limiter in auth.ts constructs a Ratelimit at
// module scope when env vars are present. Providing a controllable mock keeps
// tests deterministic regardless of local env, and lets us assert the key.
// Arrow-function impls can't be used with `new`, so both mocks use classes.
const mockRateLimit = vi.fn();
vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    limit(...args: unknown[]) {
      return mockRateLimit(...args);
    }
    static slidingWindow() {
      return "sliding-window-config";
    }
  }
  return { Ratelimit };
});

vi.mock("@upstash/redis", () => {
  class Redis {}
  return { Redis };
});

// Force the lazy limiter to initialize inside auth.ts on first import.
process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

// Import after mocks are set up
import { authOptions } from "@/lib/auth";

// Get the authorize function from the credentials provider
const getAuthorize = () => {
  const credentialsProvider = authOptions.providers[0] as {
    options: { authorize: (credentials: { email: string; password: string }) => Promise<unknown> };
  };
  return credentialsProvider.options.authorize;
};

describe("Auth - authorize function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: rate limit is available. Individual tests override to simulate
    // exhaustion.
    mockRateLimit.mockResolvedValue({ success: true });
  });

  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    password: "hashedPassword123",
    firstName: "John",
    lastName: "Doe",
    role: "STAFF",
    isActive: true,
    tokenVersion: 0,
  };

  it("should return user object for valid credentials", async () => {
    const authorize = getAuthorize();
    mockFindUnique.mockResolvedValue(mockUser);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const result = await authorize({
      email: "test@example.com",
      password: "correctPassword",
    });

    expect(result).toEqual({
      id: "user-123",
      email: "test@example.com",
      name: "John Doe",
      firstName: "John",
      role: "STAFF",
      tokenVersion: 0,
    });
  });

  it("should throw error for missing email", async () => {
    const authorize = getAuthorize();

    await expect(
      authorize({ email: "", password: "password123" })
    ).rejects.toThrow("Invalid email or password");
  });

  it("should throw error for missing password", async () => {
    const authorize = getAuthorize();

    await expect(
      authorize({ email: "test@example.com", password: "" })
    ).rejects.toThrow("Invalid email or password");
  });

  it("should throw generic error for non-existent user", async () => {
    const authorize = getAuthorize();
    mockFindUnique.mockResolvedValue(null);

    await expect(
      authorize({ email: "nonexistent@example.com", password: "password123" })
    ).rejects.toThrow("Invalid email or password");
  });

  it("should throw generic error for deactivated account", async () => {
    const authorize = getAuthorize();
    mockFindUnique.mockResolvedValue({ ...mockUser, isActive: false });

    await expect(
      authorize({ email: "test@example.com", password: "password123" })
    ).rejects.toThrow("Invalid email or password");
  });

  it("should throw generic error for invalid password", async () => {
    const authorize = getAuthorize();
    mockFindUnique.mockResolvedValue(mockUser);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    await expect(
      authorize({ email: "test@example.com", password: "wrongPassword" })
    ).rejects.toThrow("Invalid email or password");
  });

  it("should use same error message for all failure cases (security)", async () => {
    const authorize = getAuthorize();
    const expectedError = "Invalid email or password";

    // Test non-existent user
    mockFindUnique.mockResolvedValue(null);
    await expect(
      authorize({ email: "a@example.com", password: "pass" })
    ).rejects.toThrow(expectedError);

    // Test deactivated account
    mockFindUnique.mockResolvedValue({ ...mockUser, isActive: false });
    await expect(
      authorize({ email: "b@example.com", password: "pass" })
    ).rejects.toThrow(expectedError);

    // Test wrong password
    mockFindUnique.mockResolvedValue(mockUser);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
    await expect(
      authorize({ email: "c@example.com", password: "wrong" })
    ).rejects.toThrow(expectedError);
  });
});

describe("Auth - per-email rate limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws generic error when the per-email limit is exhausted", async () => {
    const authorize = getAuthorize();
    mockRateLimit.mockResolvedValue({ success: false });

    await expect(
      authorize({ email: "victim@example.com", password: "pw" }),
    ).rejects.toThrow("Invalid email or password");

    // Short-circuits before touching the DB or bcrypt
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(vi.mocked(bcrypt.compare)).not.toHaveBeenCalled();
  });

  it("keys the limit on the normalized (lowercased, trimmed) email", async () => {
    const authorize = getAuthorize();
    mockRateLimit.mockResolvedValue({ success: true });
    mockFindUnique.mockResolvedValue({
      id: "u",
      email: "  USER@Example.com  ",
      password: "hashed",
      firstName: "U",
      lastName: "L",
      role: "STAFF",
      isActive: true,
      tokenVersion: 0,
    });
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    await authorize({ email: "  USER@Example.com  ", password: "pw" });

    expect(mockRateLimit).toHaveBeenCalledWith("user@example.com");
  });

  it("does not touch the limiter when credentials shape is missing", async () => {
    const authorize = getAuthorize();

    await expect(
      authorize({ email: "", password: "pw" }),
    ).rejects.toThrow("Invalid email or password");
    expect(mockRateLimit).not.toHaveBeenCalled();
  });
});

describe("Auth - JWT callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUser = {
    id: "user-123",
    role: "STAFF",
    firstName: "John",
    tokenVersion: 0,
  };

  it("should populate token on initial sign in", async () => {
    const jwtCallback = authOptions.callbacks!.jwt!;

    const result = await jwtCallback({
      token: {},
      user: mockUser,
      account: null,
      trigger: "signIn",
    } as any);

    expect(result).toMatchObject({
      id: "user-123",
      role: "STAFF",
      firstName: "John",
      tokenVersion: 0,
    });
  });

  it("should invalidate token when tokenVersion changes", async () => {
    const jwtCallback = authOptions.callbacks!.jwt!;

    // User's tokenVersion in DB is now 1 (password changed)
    mockFindUnique.mockResolvedValue({ tokenVersion: 1, isActive: true });

    const result = await jwtCallback({
      token: { id: "user-123", tokenVersion: 0 }, // Old tokenVersion
      user: undefined,
      account: null,
      trigger: "update",
    } as any);

    expect(result.id).toBeNull();
  });

  it("should invalidate token when user is deactivated", async () => {
    const jwtCallback = authOptions.callbacks!.jwt!;

    mockFindUnique.mockResolvedValue({ tokenVersion: 0, isActive: false });

    const result = await jwtCallback({
      token: { id: "user-123", tokenVersion: 0 },
      user: undefined,
      account: null,
      trigger: "update",
    } as any);

    expect(result.id).toBeNull();
  });

  it("should invalidate token when user is deleted", async () => {
    const jwtCallback = authOptions.callbacks!.jwt!;

    mockFindUnique.mockResolvedValue(null);

    const result = await jwtCallback({
      token: { id: "user-123", tokenVersion: 0 },
      user: undefined,
      account: null,
      trigger: "update",
    } as any);

    expect(result.id).toBeNull();
  });

  it("should keep token valid when tokenVersion matches", async () => {
    const jwtCallback = authOptions.callbacks!.jwt!;

    mockFindUnique.mockResolvedValue({ tokenVersion: 0, isActive: true });

    const result = await jwtCallback({
      token: { id: "user-123", tokenVersion: 0, role: "STAFF" },
      user: undefined,
      account: null,
      trigger: "update",
    } as any);

    expect(result.id).toBe("user-123");
  });
});

describe("Auth - Session callback", () => {
  it("should return empty session when token is invalidated", async () => {
    const sessionCallback = authOptions.callbacks!.session!;

    const result = await sessionCallback({
      session: { user: { name: "John" }, expires: "" },
      token: { id: null }, // Invalidated token
    } as any);

    expect(result.user).toBeUndefined();
  });

  it("should populate session user from token", async () => {
    const sessionCallback = authOptions.callbacks!.session!;

    const result = await sessionCallback({
      session: { user: { name: "John" }, expires: "" },
      token: { id: "user-123", role: "GENERAL_MANAGER", firstName: "John" },
    } as any);

    expect(result.user).toMatchObject({
      id: "user-123",
      role: "GENERAL_MANAGER",
      firstName: "John",
    });
  });
});

describe("Auth - Configuration", () => {
  it("should use JWT strategy", () => {
    expect(authOptions.session?.strategy).toBe("jwt");
  });

  it("should have 24 hour session max age", () => {
    expect(authOptions.session?.maxAge).toBe(24 * 60 * 60);
  });

  it("should redirect to /login for sign in", () => {
    expect(authOptions.pages?.signIn).toBe("/login");
  });
});
