/* eslint-disable @typescript-eslint/no-explicit-any --
   NextAuth callback param types (JWTCallbackArgs, SessionCallbackArgs) are
   large generic unions that don't add value in test fixtures. Callback args
   are cast to `any` throughout this file for readability. */
import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

// Mock Prisma
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

// Mock bcrypt. Default `getRounds` returns the current cost so tests that
// don't care about rehash-on-login don't accidentally trigger it.
vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
    getRounds: vi.fn(() => 12),
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
    options: {
      authorize: (credentials: {
        email: string;
        password: string;
        remember?: string;
      }) => Promise<unknown>;
    };
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
      remember: false,
    });
  });

  it("returns user.remember: true when credentials.remember is '1'", async () => {
    const authorize = getAuthorize();
    mockFindUnique.mockResolvedValue(mockUser);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const result = (await authorize({
      email: "test@example.com",
      password: "correctPassword",
      remember: "1",
    })) as { remember: boolean };

    expect(result.remember).toBe(true);
  });

  it("returns user.remember: false when credentials.remember is '0'", async () => {
    const authorize = getAuthorize();
    mockFindUnique.mockResolvedValue(mockUser);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const result = (await authorize({
      email: "test@example.com",
      password: "correctPassword",
      remember: "0",
    })) as { remember: boolean };

    expect(result.remember).toBe(false);
  });

  it("returns user.remember: false when credentials.remember is omitted", async () => {
    const authorize = getAuthorize();
    mockFindUnique.mockResolvedValue(mockUser);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const result = (await authorize({
      email: "test@example.com",
      password: "correctPassword",
    })) as { remember: boolean };

    expect(result.remember).toBe(false);
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

  // Regression guard for timing-based user enumeration: the short-circuit
  // branches must still invoke bcrypt.compare so their wall time matches the
  // wrong-password branch. Assert both the invocation and the exact args, so
  // a future refactor can't skip the compare or pass the wrong password
  // through and re-open the side channel.
  it("runs bcrypt.compare on the non-existent-user branch to equalize timing", async () => {
    const authorize = getAuthorize();
    mockFindUnique.mockResolvedValue(null);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    await expect(
      authorize({ email: "nonexistent@example.com", password: "attempted-pw" }),
    ).rejects.toThrow("Invalid email or password");

    expect(bcrypt.compare).toHaveBeenCalledTimes(1);
    expect(bcrypt.compare).toHaveBeenCalledWith(
      "attempted-pw",
      expect.stringMatching(/^\$2[aby]\$12\$/),
    );
  });

  it("runs bcrypt.compare on the deactivated-account branch to equalize timing", async () => {
    const authorize = getAuthorize();
    mockFindUnique.mockResolvedValue({ ...mockUser, isActive: false });
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    await expect(
      authorize({ email: "test@example.com", password: "attempted-pw" }),
    ).rejects.toThrow("Invalid email or password");

    expect(bcrypt.compare).toHaveBeenCalledTimes(1);
    expect(bcrypt.compare).toHaveBeenCalledWith(
      "attempted-pw",
      expect.stringMatching(/^\$2[aby]\$12\$/),
    );
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

  // Transparent bcrypt-cost migration: a successful login with a
  // cost < BCRYPT_COST hash should trigger a re-hash + prisma.user.update,
  // so old users get upgraded on their next visit without changing their
  // password.
  it("rehashes the password to cost 12 on successful login when stored hash is cost 10", async () => {
    const authorize = getAuthorize();
    mockFindUnique.mockResolvedValue(mockUser);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(bcrypt.getRounds).mockReturnValue(10);
    vi.mocked(bcrypt.hash).mockResolvedValue(
      "$2b$12$freshlyRehashed" as never,
    );

    await authorize({ email: "test@example.com", password: "correct" });

    expect(bcrypt.hash).toHaveBeenCalledWith("correct", 12);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "user-123" },
      data: { password: "$2b$12$freshlyRehashed" },
    });
  });

  it("does NOT rehash when the stored hash is already at cost 12", async () => {
    const authorize = getAuthorize();
    mockFindUnique.mockResolvedValue(mockUser);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(bcrypt.getRounds).mockReturnValue(12);

    await authorize({ email: "test@example.com", password: "correct" });

    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
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
      email: "user@example.com",
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

  it("looks up the DB row via the normalized email so mixed-case input matches lowercased rows", async () => {
    const authorize = getAuthorize();
    mockRateLimit.mockResolvedValue({ success: true });
    mockFindUnique.mockResolvedValue({
      id: "u",
      email: "user@example.com",
      password: "hashed",
      firstName: "U",
      lastName: "L",
      role: "STAFF",
      isActive: true,
      tokenVersion: 0,
    });
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    await authorize({ email: "  USER@Example.com  ", password: "pw" });

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { email: "user@example.com" },
    });
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

    // The callback also re-reads the row after the sign-in branch to
    // rehydrate mutable fields — the DB must agree with the freshly
    // returned user for the token to survive.
    mockFindUnique.mockResolvedValue({
      tokenVersion: 0,
      isActive: true,
      role: "STAFF",
      firstName: "John",
    });

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
    mockFindUnique.mockResolvedValue({
      tokenVersion: 1,
      isActive: true,
      role: "STAFF",
      firstName: "John",
    });

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

    mockFindUnique.mockResolvedValue({
      tokenVersion: 0,
      isActive: false,
      role: "STAFF",
      firstName: "John",
    });

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

    mockFindUnique.mockResolvedValue({
      tokenVersion: 0,
      isActive: true,
      role: "STAFF",
      firstName: "John",
    });

    const result = await jwtCallback({
      token: { id: "user-123", tokenVersion: 0, role: "STAFF" },
      user: undefined,
      account: null,
      trigger: "update",
    } as any);

    expect(result.id).toBe("user-123");
  });

  it("rehydrates role and firstName from the DB on subsequent requests so mutable user fields are never trusted as a JWT cache", async () => {
    const jwtCallback = authOptions.callbacks!.jwt!;

    // Simulate a stale JWT: user was STAFF at login, has since been
    // promoted to GENERAL_MANAGER and renamed in the DB. No
    // tokenVersion bump — the invariant is that role/firstName drift
    // is closed by the callback's re-read, not by a manual bump.
    mockFindUnique.mockResolvedValue({
      tokenVersion: 0,
      isActive: true,
      role: "GENERAL_MANAGER",
      firstName: "Johnny",
    });

    const result = (await jwtCallback({
      token: {
        id: "user-123",
        tokenVersion: 0,
        role: "STAFF",
        firstName: "John",
      },
      user: undefined,
      account: null,
      trigger: "update",
    } as any)) as { id: string; role: string; firstName: string };

    expect(result.id).toBe("user-123");
    expect(result.role).toBe("GENERAL_MANAGER");
    expect(result.firstName).toBe("Johnny");

    // Confirm the widened select — the whole fix depends on this shape.
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "user-123" },
      select: {
        tokenVersion: true,
        isActive: true,
        role: true,
        firstName: true,
      },
    });
  });

  it("sets token.expiresAt ~30 days out on initial sign in with remember: true", async () => {
    const jwtCallback = authOptions.callbacks!.jwt!;
    const before = Math.floor(Date.now() / 1000);

    const result = (await jwtCallback({
      token: {},
      user: { ...mockUser, remember: true },
      account: null,
      trigger: "signIn",
    } as any)) as { expiresAt: number; remember: boolean };

    const after = Math.floor(Date.now() / 1000);
    const thirtyDays = 30 * 24 * 60 * 60;

    expect(result.remember).toBe(true);
    expect(result.expiresAt).toBeGreaterThanOrEqual(before + thirtyDays);
    expect(result.expiresAt).toBeLessThanOrEqual(after + thirtyDays);
  });

  it("sets token.expiresAt ~12 hours out on initial sign in with remember: false", async () => {
    const jwtCallback = authOptions.callbacks!.jwt!;
    const before = Math.floor(Date.now() / 1000);

    const result = (await jwtCallback({
      token: {},
      user: { ...mockUser, remember: false },
      account: null,
      trigger: "signIn",
    } as any)) as { expiresAt: number; remember: boolean };

    const after = Math.floor(Date.now() / 1000);
    const twelveHours = 12 * 60 * 60;

    expect(result.remember).toBe(false);
    expect(result.expiresAt).toBeGreaterThanOrEqual(before + twelveHours);
    expect(result.expiresAt).toBeLessThanOrEqual(after + twelveHours);
  });

  it("invalidates the token when now > token.expiresAt", async () => {
    const jwtCallback = authOptions.callbacks!.jwt!;
    const oneSecondAgo = Math.floor(Date.now() / 1000) - 1;

    const result = await jwtCallback({
      token: {
        id: "user-123",
        tokenVersion: 0,
        role: "STAFF",
        expiresAt: oneSecondAgo,
      },
      user: undefined,
      account: null,
      trigger: "update",
    } as any);

    expect(result.id).toBeNull();
    // Should short-circuit before hitting the DB
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("passes through legacy tokens without token.expiresAt (backward compat)", async () => {
    const jwtCallback = authOptions.callbacks!.jwt!;
    mockFindUnique.mockResolvedValue({
      tokenVersion: 0,
      isActive: true,
      role: "STAFF",
      firstName: "John",
    });

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

  it("reflects token.expiresAt in session.expires", async () => {
    const sessionCallback = authOptions.callbacks!.session!;
    const expiresAtSeconds = Math.floor(Date.now() / 1000) + 12 * 60 * 60;

    const result = await sessionCallback({
      session: { user: { name: "John" }, expires: "1970-01-01T00:00:00.000Z" },
      token: {
        id: "user-123",
        role: "STAFF",
        firstName: "John",
        expiresAt: expiresAtSeconds,
      },
    } as any);

    expect(result.expires).toBe(
      new Date(expiresAtSeconds * 1000).toISOString(),
    );
  });
});

describe("Auth - Configuration", () => {
  it("should use JWT strategy", () => {
    expect(authOptions.session?.strategy).toBe("jwt");
  });

  it("sets the cookie-lifetime ceiling to 30 days for remember-device", () => {
    // Per-user actual duration (12h vs 30d) is enforced inside the jwt
    // callback via token.expiresAt; session.maxAge is the ceiling that
    // both flows share so unchecked-remember tokens can invalidate on
    // schedule while checked ones survive.
    expect(authOptions.session?.maxAge).toBe(30 * 24 * 60 * 60);
  });

  it("rotates the JWT every hour of activity", () => {
    expect(authOptions.session?.updateAge).toBe(60 * 60);
  });

  it("should redirect to /login for sign in", () => {
    expect(authOptions.pages?.signIn).toBe("/login");
  });

  it("throws at module load when NEXTAUTH_SECRET is missing", async () => {
    vi.resetModules();
    vi.stubEnv("NEXTAUTH_SECRET", "");

    await expect(import("@/lib/auth")).rejects.toThrow(
      /NEXTAUTH_SECRET is required/,
    );

    vi.unstubAllEnvs();
  });
});
