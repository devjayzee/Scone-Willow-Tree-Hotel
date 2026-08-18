import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Same Upstash class stubs as the main rate-limit-service test — required
// because the module still imports @upstash/ratelimit / redis at the top,
// even when the guard we're testing throws before the factories run.
vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
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

async function importFresh() {
  vi.resetModules();
  return import("@/lib/services/rate-limit-service");
}

describe("rate-limit-service boot guard", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws in production when both Upstash vars are missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    await expect(importFresh()).rejects.toThrow(
      /UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production/,
    );
  });

  it("throws in production when only the URL is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "some-token");
    await expect(importFresh()).rejects.toThrow(
      /required in production/,
    );
  });

  it("throws in production when only the token is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://x.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    await expect(importFresh()).rejects.toThrow(
      /required in production/,
    );
  });

  it("does not throw in production when both vars are present", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://x.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "some-token");
    await expect(importFresh()).resolves.toBeDefined();
  });

  it("does not throw in development with vars missing", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    await expect(importFresh()).resolves.toBeDefined();
  });

  it("does not throw in test with vars missing", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    await expect(importFresh()).resolves.toBeDefined();
  });
});
