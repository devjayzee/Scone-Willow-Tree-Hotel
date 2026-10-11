/* eslint-disable @typescript-eslint/no-explicit-any --
   NextAuth callback param types (JWTCallbackArgs, SessionCallbackArgs) are
   large generic unions that don't add value in test fixtures. Callback args
   are cast to `any` throughout this file for readability. */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import bcrypt from "bcryptjs";
import { createHmac, hkdfSync, randomBytes } from "node:crypto";
import {
  DEVICE_COOKIE_MAX_AGE,
  INVALID_CREDENTIALS,
  SIGN_IN_PAUSED,
} from "@/lib/constants/auth";
import {
  DEVICE_COOKIE_NAME,
  DEVICE_COOKIE_OPTIONS,
  findTrustedDevice,
  issueDeviceCookie,
} from "@/lib/utils/device-cookie";

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

// Mock Upstash — the limiters in rate-limit-service.ts construct a Ratelimit
// at first use when env vars are present. Providing a controllable mock keeps
// tests deterministic regardless of local env, and lets us assert the key.
// Arrow-function impls can't be used with `new`, so both mocks use classes.
//
// Two modes. Default: every limiter shares `mockRateLimit` (the plain mock the
// older blocks assert on). With `fakeLimits.enabled`, each limiter counts in
// memory under `prefix:id`, with the max taken from slidingWindow(n, ...), so
// the real consumeLoginAttempt runs against realistic buckets.
const mockRateLimit = vi.fn();
const fakeLimits = { enabled: false, counts: new Map<string, number>() };
vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    prefix: string;
    max: number;
    constructor(opts: { prefix: string; limiter: string }) {
      this.prefix = opts.prefix;
      this.max = Number(String(opts.limiter).split(":")[1]);
    }
    async limit(id: string) {
      if (!fakeLimits.enabled) return mockRateLimit(id);
      const key = `${this.prefix}:${id}`;
      const count = (fakeLimits.counts.get(key) ?? 0) + 1;
      fakeLimits.counts.set(key, count);
      return { success: count <= this.max };
    }
    static slidingWindow(max: number) {
      return `sliding-window:${max}`;
    }
  }
  return { Ratelimit };
});

// In-memory cookie jar standing in for next/headers cookies().
const cookieJar = new Map<string, string>();
const mockCookieSet = vi.fn();
const cookieState = { setThrows: false };
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined,
    set: (name: string, value: string, options: unknown) => {
      mockCookieSet(name, value, options);
      if (cookieState.setThrows) throw new Error("headers already sent");
      cookieJar.set(name, value);
    },
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Fake Redis for the trusted-device "valid after" key: a string map plus a
// log of every GET key, so tests can assert how many reads a sign-in made.
const redisState = {
  store: new Map<string, unknown>(),
  gets: [] as string[],
  sets: [] as unknown[][],
};
vi.mock("@upstash/redis", () => {
  class Redis {
    async get(key: string) {
      redisState.gets.push(key);
      return redisState.store.get(key) ?? null;
    }
    async set(...args: unknown[]) {
      redisState.sets.push(args);
      redisState.store.set(String(args[0]), args[1]);
      return "OK";
    }
  }
  return { Redis };
});

// Force the lazy limiter to initialize inside auth.ts on first import.
process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

// Import after mocks are set up
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";

// Get the authorize function from the credentials provider
const getAuthorize = () => {
  const credentialsProvider = authOptions.providers[0] as {
    options: {
      authorize: (
        credentials: {
          email: string;
          password: string;
          remember?: string;
        },
        req?: { headers?: Record<string, string> },
      ) => Promise<unknown>;
    };
  };
  return credentialsProvider.options.authorize;
};

// Shared mock state must not leak between tests (or across shuffled order):
// successful authorize calls write a valid device entry into the cookie jar.
beforeEach(() => {
  cookieJar.clear();
  cookieState.setThrows = false;
  fakeLimits.counts.clear();
  redisState.store.clear();
  redisState.gets.length = 0;
  redisState.sets.length = 0;
});

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

  it("throws SignInPaused when the per-email limit is exhausted", async () => {
    const authorize = getAuthorize();
    // The IP limiter (key 127.0.0.1) allows; only the email limiter refuses.
    mockRateLimit.mockImplementation(async (id: string) => ({
      success: id !== "victim@example.com",
    }));

    await expect(
      authorize({ email: "victim@example.com", password: "pw" }),
    ).rejects.toThrow("SignInPaused");

    // The IP limiter was consulted and allowed; the email limiter refused.
    expect(mockRateLimit).toHaveBeenCalledWith("127.0.0.1");
    expect(mockRateLimit).toHaveBeenCalledWith("victim@example.com");

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

// ---------------------------------------------------------------------------
// Login limits with the device cookie. The real consumeLoginAttempt runs
// against in-memory buckets (see fakeLimits above).
// ---------------------------------------------------------------------------

const SECRET = process.env.NEXTAUTH_SECRET as string;
const nowSec = () => Math.floor(Date.now() / 1000);

// Independent mint of one cookie entry, straight from the documented format
// (plan + device-cookie.ts header), so these tests do not depend on
// issueDeviceCookie being implemented to build their fixtures.
function mintEntry(
  email: string,
  opts: { nonce?: string; iat?: number } = {},
): { entry: string; nonce: string } {
  const nonce = opts.nonce ?? randomBytes(16).toString("base64url");
  const iat = opts.iat ?? nowSec();
  const key = Buffer.from(
    hkdfSync("sha256", SECRET, "", "wt-device-cookie-v1", 32),
  );
  const sig = createHmac("sha256", key)
    .update(`wt-device.v1|${email}|${nonce}|${iat}`)
    .digest("base64url");
  return { entry: `${nonce}.${iat}.${sig}`, nonce };
}

const VICTIM = "victim@example.com";
const EMAIL_BUCKET = `ratelimit:login-email:${VICTIM}`;
const TRUSTED_BUCKET = `ratelimit:login-trusted:${VICTIM}`;
const FULL = { email: 10, ip: 5, trusted: 10 };
const countOf = (key: string) => fakeLimits.counts.get(key) ?? 0;
const VALID_AFTER_KEY = `trusted-device:valid-after:${VICTIM}`;
const IP_BUCKET = "ratelimit:login:198.51.100.1";

describe("Auth - login limits and trusted device", () => {
  const user = {
    id: "user-123",
    email: VICTIM,
    password: "hashedPassword123",
    firstName: "Vic",
    lastName: "Tim",
    role: "STAFF",
    isActive: true,
    tokenVersion: 0,
  };
  const from = (ip: string) => ({ headers: { "x-forwarded-for": ip } });
  const creds = (password = "correct") => ({ email: VICTIM, password });
  const settle = async (p: Promise<unknown>) =>
    p.then(
      () => "ok",
      (e: Error) => e.message,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    fakeLimits.enabled = true;
    fakeLimits.counts.clear();
    cookieJar.clear();
    cookieState.setThrows = false;
    mockFindUnique.mockResolvedValue(user);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(bcrypt.getRounds).mockReturnValue(12);
  });

  afterEach(() => {
    fakeLimits.enabled = false;
  });

  describe("a browser the user has signed in on before", () => {
    it("signs in while the email bucket and the shared IP bucket are both full", async () => {
      fakeLimits.counts.set(EMAIL_BUCKET, FULL.email);
      fakeLimits.counts.set("ratelimit:login:203.0.113.7", FULL.ip);
      cookieJar.set(DEVICE_COOKIE_NAME, mintEntry(VICTIM).entry);

      const result = await getAuthorize()(creds(), from("203.0.113.7"));

      expect(result).toMatchObject({ id: "user-123" });
      // Only the shared trusted bucket was spent.
      expect(countOf(TRUSTED_BUCKET)).toBe(1);
      expect(countOf(EMAIL_BUCKET)).toBe(FULL.email);
      expect(countOf("ratelimit:login:203.0.113.7")).toBe(FULL.ip);
    });

    it("signs in from a full shared IP bucket (regression guard)", async () => {
      fakeLimits.counts.set("ratelimit:login:203.0.113.7", FULL.ip);
      cookieJar.set(DEVICE_COOKIE_NAME, mintEntry(VICTIM).entry);

      await expect(
        getAuthorize()(creds(), from("203.0.113.7")),
      ).resolves.toMatchObject({ id: "user-123" });
    });

    it("keys the trusted bucket on the normalized email alone, not the cookie nonce", async () => {
      const { entry, nonce } = mintEntry(VICTIM);
      cookieJar.set(DEVICE_COOKIE_NAME, entry);

      await getAuthorize()(
        { email: "  VICTIM@Example.com ", password: "correct" },
        from("203.0.113.7"),
      );

      expect(countOf(TRUSTED_BUCKET)).toBe(1);
      expect(countOf(`${TRUSTED_BUCKET}:${nonce}`)).toBe(0);
    });

    it("stops after 10 wrong passwords with SignInPaused and never touches the email or IP bucket", async () => {
      cookieJar.set(DEVICE_COOKIE_NAME, mintEntry(VICTIM).entry);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      const authorize = getAuthorize();

      const results: string[] = [];
      for (let i = 0; i < 11; i++) {
        results.push(await settle(authorize(creds("wrong"), from("203.0.113.7"))));
      }

      expect(results).toEqual([
        ...Array(10).fill(INVALID_CREDENTIALS),
        SIGN_IN_PAUSED,
      ]);
      expect(vi.mocked(bcrypt.compare)).toHaveBeenCalledTimes(10);
      expect(countOf(EMAIL_BUCKET)).toBe(0);
      expect(countOf("ratelimit:login:203.0.113.7")).toBe(0);
    });
  });

  describe("one trusted bucket per account", () => {
    const wrong = () => vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
    const withDevice = (email: string, entry = mintEntry(email).entry) =>
      cookieJar.set(DEVICE_COOKIE_NAME, entry);

    it.each([["the first device", 0], ["the second device", 1]])(
      "two trusted devices share the cap: 10 wrong passwords split across them, then %s is paused",
      async (_n, which) => {
        wrong();
        const devices = [mintEntry(VICTIM).entry, mintEntry(VICTIM).entry];
        const authorize = getAuthorize();

        const results: string[] = [];
        for (let i = 0; i < 10; i++) {
          withDevice(VICTIM, devices[i % 2]);
          results.push(await settle(authorize(creds("wrong"), from("203.0.113.7"))));
        }
        withDevice(VICTIM, devices[which]);
        results.push(await settle(authorize(creds("wrong"), from("203.0.113.7"))));

        expect(results).toEqual([...Array(10).fill(INVALID_CREDENTIALS), SIGN_IN_PAUSED]);
        expect(vi.mocked(bcrypt.compare)).toHaveBeenCalledTimes(10);
        expect(countOf(EMAIL_BUCKET)).toBe(0);
        expect(countOf("ratelimit:login:203.0.113.7")).toBe(0);
      },
    );

    it("fresh nonces add no budget: 11 distinct valid entries all spend the same bucket", async () => {
      wrong();
      const authorize = getAuthorize();

      const results: string[] = [];
      for (let i = 0; i < 11; i++) {
        withDevice(VICTIM);
        results.push(await settle(authorize(creds("wrong"), from("203.0.113.7"))));
      }

      expect(results).toEqual([...Array(10).fill(INVALID_CREDENTIALS), SIGN_IN_PAUSED]);
      expect(vi.mocked(bcrypt.compare)).toHaveBeenCalledTimes(10);
      expect(countOf(TRUSTED_BUCKET)).toBe(11);
      const trustedKeys = [...fakeLimits.counts.keys()].filter((k) =>
        k.startsWith("ratelimit:login-trusted"),
      );
      expect(trustedKeys).toEqual([TRUSTED_BUCKET]);
    });

    it("bounds the account total: a full trusted bucket leaves the untrusted email bucket its own 10", async () => {
      wrong();
      const authorize = getAuthorize();
      for (let i = 0; i < 10; i++) {
        withDevice(VICTIM);
        await settle(authorize(creds("wrong"), from("203.0.113.7")));
      }
      expect(vi.mocked(bcrypt.compare)).toHaveBeenCalledTimes(10);
      withDevice(VICTIM);
      expect(await settle(authorize(creds("wrong"), from("203.0.113.7")))).toBe(SIGN_IN_PAUSED);

      cookieJar.clear();
      const untrusted: string[] = [];
      for (const ip of ["198.51.100.1", "198.51.100.2"]) {
        for (let i = 0; i < 5; i++) {
          untrusted.push(await settle(authorize(creds("wrong"), from(ip))));
        }
      }
      untrusted.push(await settle(authorize(creds("wrong"), from("198.51.100.3"))));

      expect(untrusted).toEqual([...Array(10).fill(INVALID_CREDENTIALS), SIGN_IN_PAUSED]);
      expect(vi.mocked(bcrypt.compare)).toHaveBeenCalledTimes(20);
    });

    it("bounds the account total the other way: a full email bucket leaves the trusted bucket its own 10", async () => {
      wrong();
      const authorize = getAuthorize();
      for (const ip of ["198.51.100.1", "198.51.100.2"]) {
        for (let i = 0; i < 5; i++) await settle(authorize(creds("wrong"), from(ip)));
      }
      expect(await settle(authorize(creds("wrong"), from("198.51.100.3")))).toBe(SIGN_IN_PAUSED);
      expect(vi.mocked(bcrypt.compare)).toHaveBeenCalledTimes(10);

      const trusted: string[] = [];
      for (let i = 0; i < 11; i++) {
        withDevice(VICTIM);
        trusted.push(await settle(authorize(creds("wrong"), from("198.51.100.1"))));
      }

      expect(trusted).toEqual([...Array(10).fill(INVALID_CREDENTIALS), SIGN_IN_PAUSED]);
      expect(vi.mocked(bcrypt.compare)).toHaveBeenCalledTimes(20);
    });

    it("another account is unaffected: a trusted device for a different email has its own bucket", async () => {
      const colleague = "colleague@example.com";
      fakeLimits.counts.set(TRUSTED_BUCKET, FULL.trusted);
      mockFindUnique.mockResolvedValue({ ...user, id: "user-456", email: colleague });
      withDevice(colleague);

      await expect(
        getAuthorize()({ email: colleague, password: "correct" }, from("203.0.113.7")),
      ).resolves.toMatchObject({ id: "user-456" });

      expect(countOf(`ratelimit:login-trusted:${colleague}`)).toBe(1);
      expect(countOf(TRUSTED_BUCKET)).toBe(FULL.trusted);
    });
  });

  describe("trusted device does not bypass the account checks", () => {
    it("refuses a valid device entry for an inactive account", async () => {
      cookieJar.set(DEVICE_COOKIE_NAME, mintEntry(VICTIM).entry);
      mockFindUnique.mockResolvedValue({ ...user, isActive: false });

      await expect(
        getAuthorize()(creds(), from("203.0.113.7")),
      ).rejects.toThrow(INVALID_CREDENTIALS);

      expect(mockFindUnique).toHaveBeenCalledTimes(1);
      expect(mockCookieSet).not.toHaveBeenCalled();
    });

    it("refuses a valid device entry for an email with no account", async () => {
      cookieJar.set(DEVICE_COOKIE_NAME, mintEntry(VICTIM).entry);
      mockFindUnique.mockResolvedValue(null);

      await expect(
        getAuthorize()(creds(), from("203.0.113.7")),
      ).rejects.toThrow(INVALID_CREDENTIALS);

      expect(mockFindUnique).toHaveBeenCalledTimes(1);
      expect(mockCookieSet).not.toHaveBeenCalled();
    });
  });

  describe("a device entry issued before a revocation", () => {
    // Entry issued 100s ago; the account's devices became valid 50s ago.
    const staleEntry = () => mintEntry(VICTIM, { iat: nowSec() - 100 }).entry;
    const revokeAt = (sec: number) => redisState.store.set(VALID_AFTER_KEY, sec);

    it("A1: spends the IP and email buckets and not the trusted bucket", async () => {
      revokeAt(nowSec() - 50);
      cookieJar.set(DEVICE_COOKIE_NAME, staleEntry());

      await getAuthorize()(creds(), from("198.51.100.1"));

      expect(countOf(IP_BUCKET)).toBe(1);
      expect(countOf(EMAIL_BUCKET)).toBe(1);
      expect(countOf(TRUSTED_BUCKET)).toBe(0);
    });

    it("A2: is paused before the lookup when the email bucket is full", async () => {
      revokeAt(nowSec() - 50);
      fakeLimits.counts.set(EMAIL_BUCKET, FULL.email);
      cookieJar.set(DEVICE_COOKIE_NAME, staleEntry());

      await expect(
        getAuthorize()(creds(), from("198.51.100.1")),
      ).rejects.toThrow(SIGN_IN_PAUSED);

      expect(mockFindUnique).not.toHaveBeenCalled();
      expect(vi.mocked(bcrypt.compare)).not.toHaveBeenCalled();
      expect(countOf(TRUSTED_BUCKET)).toBe(0);
    });

    it("A3: signs in untrusted with the right password, then the reissued cookie is trusted", async () => {
      revokeAt(nowSec() - 50);
      cookieJar.set(DEVICE_COOKIE_NAME, staleEntry());
      const authorize = getAuthorize();

      await expect(
        authorize(creds(), from("198.51.100.1")),
      ).resolves.toMatchObject({ id: "user-123" });
      expect(countOf(TRUSTED_BUCKET)).toBe(0);
      expect(countOf(EMAIL_BUCKET)).toBe(1);

      // The jar now holds the reissued entry. Fill the untrusted buckets: only
      // a trusted attempt can still get in.
      fakeLimits.counts.set(EMAIL_BUCKET, FULL.email);
      fakeLimits.counts.set(IP_BUCKET, FULL.ip);
      await expect(
        authorize(creds(), from("198.51.100.1")),
      ).resolves.toMatchObject({ id: "user-123" });
      expect(countOf(TRUSTED_BUCKET)).toBe(1);
    });

    it("A4 (guard): a junk cookie, or none, causes no Redis read", async () => {
      cookieJar.set(DEVICE_COOKIE_NAME, "not-a-device-cookie");
      await getAuthorize()(creds(), from("198.51.100.1"));
      cookieJar.clear();
      await getAuthorize()(creds(), from("198.51.100.1"));

      expect(redisState.gets).toEqual([]);
    });

    it("A4b: a tampered entry causes no Redis read", async () => {
      const [n, i, sig] = mintEntry(VICTIM).entry.split(".");
      cookieJar.set(
        DEVICE_COOKIE_NAME,
        `${n}.${i}.${sig[0] === "A" ? "B" : "A"}${sig.slice(1)}`,
      );

      await getAuthorize()(creds(), from("198.51.100.1"));

      expect(redisState.gets).toEqual([]);
    });

    it("A5 (guard): an entry issued after the revocation is trusted", async () => {
      revokeAt(nowSec() - 500);
      fakeLimits.counts.set(EMAIL_BUCKET, FULL.email);
      fakeLimits.counts.set(IP_BUCKET, FULL.ip);
      cookieJar.set(DEVICE_COOKIE_NAME, mintEntry(VICTIM).entry);

      await expect(
        getAuthorize()(creds(), from("198.51.100.1")),
      ).resolves.toMatchObject({ id: "user-123" });

      expect(countOf(TRUSTED_BUCKET)).toBe(1);
    });

    it("A5b: a verified entry causes exactly one read of the valid-after key", async () => {
      cookieJar.set(DEVICE_COOKIE_NAME, mintEntry(VICTIM).entry);

      await getAuthorize()(creds(), from("198.51.100.1"));

      expect(redisState.gets).toEqual([VALID_AFTER_KEY]);
    });

    it("A6 (guard): a stale entry does not get a deactivated account in", async () => {
      revokeAt(nowSec() - 50);
      cookieJar.set(DEVICE_COOKIE_NAME, staleEntry());
      mockFindUnique.mockResolvedValue({ ...user, isActive: false });

      await expect(
        getAuthorize()(creds(), from("198.51.100.1")),
      ).rejects.toThrow(INVALID_CREDENTIALS);

      expect(mockCookieSet).not.toHaveBeenCalled();
    });
  });

  describe("client IP source", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("keys the IP bucket on x-real-ip, not x-forwarded-for, on Vercel", async () => {
      vi.stubEnv("VERCEL", "1");

      await getAuthorize()(creds(), {
        headers: {
          "x-real-ip": "203.0.113.9",
          "x-forwarded-for": "198.51.100.77",
        },
      });

      expect(countOf("ratelimit:login:203.0.113.9")).toBe(1);
      expect(countOf("ratelimit:login:198.51.100.77")).toBe(0);
    });
  });

  describe("a browser without a valid cookie", () => {
    it("is told SignInPaused when the email bucket is full, before any DB or bcrypt work", async () => {
      fakeLimits.counts.set(EMAIL_BUCKET, FULL.email);

      await expect(
        getAuthorize()(creds(), from("198.51.100.1")),
      ).rejects.toThrow(SIGN_IN_PAUSED);

      expect(mockFindUnique).not.toHaveBeenCalled();
      expect(vi.mocked(bcrypt.compare)).not.toHaveBeenCalled();
    });

    it("gets the same refusal for an email with an account and one without", async () => {
      fakeLimits.counts.set(EMAIL_BUCKET, FULL.email);
      fakeLimits.counts.set("ratelimit:login-email:ghost@example.com", FULL.email);
      const authorize = getAuthorize();

      const known = await settle(authorize(creds(), from("198.51.100.1")));
      const unknown = await settle(
        authorize({ email: "ghost@example.com", password: "correct" }, from("198.51.100.1")),
      );

      expect(known).toBe(SIGN_IN_PAUSED);
      expect(unknown).toBe(known);
      expect(mockFindUnique).not.toHaveBeenCalled();
      expect(vi.mocked(bcrypt.compare)).not.toHaveBeenCalled();
    });

    it("is refused by the IP bucket inside authorize without spending the email bucket", async () => {
      fakeLimits.counts.set("ratelimit:login:198.51.100.1", FULL.ip);

      await expect(
        getAuthorize()(creds(), from("198.51.100.1")),
      ).rejects.toThrow(SIGN_IN_PAUSED);

      expect(countOf(EMAIL_BUCKET)).toBe(0);
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it("falls back to 127.0.0.1 for the IP bucket when authorize gets no request", async () => {
      await getAuthorize()(creds());

      expect(countOf("ratelimit:login:127.0.0.1")).toBe(1);
    });

    it("allows exactly 10 password checks per email across 3 IPs, then SignInPaused", async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      const authorize = getAuthorize();

      const results: string[] = [];
      for (const ip of ["198.51.100.1", "198.51.100.2", "198.51.100.3"]) {
        for (let i = 0; i < 5; i++) {
          results.push(await settle(authorize(creds("wrong"), from(ip))));
        }
      }

      expect(results).toEqual([
        ...Array(10).fill(INVALID_CREDENTIALS),
        ...Array(5).fill(SIGN_IN_PAUSED),
      ]);
      expect(vi.mocked(bcrypt.compare)).toHaveBeenCalledTimes(10);
    });
  });

  describe("cookies that must not be trusted", () => {
    const old = nowSec() - DEVICE_COOKIE_MAX_AGE - 10;
    const valid = () => mintEntry(VICTIM).entry;
    const cases: Array<[string, () => string]> = [
      [
        "a tampered signature",
        () => {
          const [n, i, sig] = valid().split(".");
          return `${n}.${i}.${sig[0] === "A" ? "B" : "A"}${sig.slice(1)}`;
        },
      ],
      ["an entry minted for another email", () => mintEntry("other@example.com").entry],
      ["an iat past the max age", () => mintEntry(VICTIM, { iat: old }).entry],
      ["an iat in the future", () => mintEntry(VICTIM, { iat: nowSec() + 3600 }).entry],
      ["an oversized value", () => `${valid()}~${"x".repeat(2100)}`],
      ["a malformed value", () => "not-a-device-cookie"],
    ];

    it.each(cases)("%s gets no extra budget (email bucket full)", async (_n, build) => {
      fakeLimits.counts.set(EMAIL_BUCKET, FULL.email);
      cookieJar.set(DEVICE_COOKIE_NAME, build());

      await expect(
        getAuthorize()(creds(), from("198.51.100.1")),
      ).rejects.toThrow(SIGN_IN_PAUSED);

      expect(mockFindUnique).not.toHaveBeenCalled();
      expect(vi.mocked(bcrypt.compare)).not.toHaveBeenCalled();
    });
  });

  describe("verified-entry guards", () => {
    it.each([
      ["an entry minted for another email", () => mintEntry("other@example.com").entry],
      [
        "an expired entry (older than 180 days)",
        () => mintEntry(VICTIM, { iat: nowSec() - DEVICE_COOKIE_MAX_AGE - 10 }).entry,
      ],
    ])("%s causes zero reads of the valid-after key", async (_n, build) => {
      cookieJar.set(DEVICE_COOKIE_NAME, build());

      await getAuthorize()(creds(), from("198.51.100.1"));

      expect(redisState.gets).toEqual([]);
    });
  });

  describe("issued entry timestamp", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("carries the second taken before the user lookup, not after bcrypt", async () => {
      const T = 1_900_000_000;
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(T * 1000);
      mockFindUnique.mockImplementation(async () => {
        vi.setSystemTime((T + 3) * 1000);
        return user;
      });
      vi.mocked(bcrypt.compare).mockImplementation((async () => {
        vi.setSystemTime((T + 7) * 1000);
        return true;
      }) as never);

      await getAuthorize()(creds(), from("198.51.100.1"));

      const value = mockCookieSet.mock.calls[0][1] as string;
      expect(findTrustedDevice(value, VICTIM, T + 10)?.iat).toBe(T);
    });
  });

  describe("the browser that completed a reset or setup", () => {
    // Shape trustCompletingBrowser writes: iat = validAfter + 1. Guard: it
    // passes today because it only exercises issueDeviceCookie and authorize.
    const V = nowSec() - 100;

    it("guard: is trusted in a lockout flood; a browser holding only an older entry stays paused", async () => {
      redisState.store.set(VALID_AFTER_KEY, V);
      fakeLimits.counts.set(EMAIL_BUCKET, FULL.email);
      fakeLimits.counts.set(IP_BUCKET, FULL.ip);
      const authorize = getAuthorize();

      cookieJar.set(DEVICE_COOKIE_NAME, issueDeviceCookie(undefined, VICTIM, V + 1));
      await expect(
        authorize(creds(), from("198.51.100.1")),
      ).resolves.toMatchObject({ id: "user-123" });
      expect(countOf(TRUSTED_BUCKET)).toBe(1);
      expect(countOf(EMAIL_BUCKET)).toBe(FULL.email + 0);

      cookieJar.set(DEVICE_COOKIE_NAME, issueDeviceCookie(undefined, VICTIM, V));
      await expect(
        authorize(creds(), from("198.51.100.1")),
      ).rejects.toThrow(SIGN_IN_PAUSED);
      expect(countOf(TRUSTED_BUCKET)).toBe(1);
    });
  });

  describe("issuing the cookie", () => {
    it("sets the device cookie with the agreed name and flags on a successful sign-in", async () => {
      await getAuthorize()(creds(), from("198.51.100.1"));

      expect(mockCookieSet).toHaveBeenCalledTimes(1);
      expect(mockCookieSet).toHaveBeenCalledWith(
        DEVICE_COOKIE_NAME,
        expect.any(String),
        DEVICE_COOKIE_OPTIONS,
      );
      const value = mockCookieSet.mock.calls[0][1] as string;
      expect(findTrustedDevice(value, VICTIM)).not.toBeNull();
      expect(value).not.toContain(VICTIM);
    });

    it("keeps the same nonce when the browser already holds a valid cookie", async () => {
      const { entry, nonce } = mintEntry(VICTIM);
      cookieJar.set(DEVICE_COOKIE_NAME, entry);

      await getAuthorize()(creds(), from("198.51.100.1"));

      expect(mockCookieSet).toHaveBeenCalledTimes(1);
      const value = mockCookieSet.mock.calls[0][1] as string;
      expect(findTrustedDevice(value, VICTIM)?.nonce).toBe(nonce);
    });

    it("still signs the user in when setting the cookie throws", async () => {
      cookieState.setThrows = true;

      await expect(
        getAuthorize()(creds(), from("198.51.100.1")),
      ).resolves.toMatchObject({ id: "user-123" });
      expect(mockCookieSet).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it("sets no cookie when the password is wrong", async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(
        getAuthorize()(creds("wrong"), from("198.51.100.1")),
      ).rejects.toThrow(INVALID_CREDENTIALS);

      expect(mockCookieSet).not.toHaveBeenCalled();
    });

    it("sets no cookie when the attempt is refused", async () => {
      fakeLimits.counts.set(EMAIL_BUCKET, FULL.email);

      await settle(getAuthorize()(creds(), from("198.51.100.1")));

      expect(mockCookieSet).not.toHaveBeenCalled();
    });
  });
});
