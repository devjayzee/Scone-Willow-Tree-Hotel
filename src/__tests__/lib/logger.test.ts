import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("logger", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("in a non-production environment (MIN_LOG_LEVEL=debug)", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "test");
      vi.resetModules();
    });

    it("logs debug messages", async () => {
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const { logger } = await import("@/lib/logger");

      logger.debug("hello");

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toContain("[DEBUG] hello");
    });

    it("includes JSON context in the formatted message", async () => {
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});
      const { logger } = await import("@/lib/logger");

      logger.info("user action", { userId: "u1" });

      expect(spy.mock.calls[0][0]).toContain('{"userId":"u1"}');
    });

    it("warn logs via console.warn", async () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { logger } = await import("@/lib/logger");

      logger.warn("careful");

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toContain("[WARN] careful");
    });

    it("error attaches name/message/stack when given an Error instance", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { logger } = await import("@/lib/logger");
      const err = new Error("boom");

      logger.error("failed", err, { bookingId: "b1" });

      const logged = spy.mock.calls[0][0];
      expect(logged).toContain("[ERROR] failed");
      expect(logged).toContain('"bookingId":"b1"');
      expect(logged).toContain('"errorName":"Error"');
      expect(logged).toContain('"errorMessage":"boom"');
    });

    it("error does not attach error fields for a non-Error value", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { logger } = await import("@/lib/logger");

      logger.error("failed", "just a string");

      const logged = spy.mock.calls[0][0];
      expect(logged).not.toContain("errorName");
    });
  });

  describe("in production (MIN_LOG_LEVEL=info)", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
      vi.resetModules();
    });

    it("suppresses debug messages", async () => {
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const { logger } = await import("@/lib/logger");

      logger.debug("should not appear");

      expect(spy).not.toHaveBeenCalled();
    });

    it("still logs info and above", async () => {
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { logger } = await import("@/lib/logger");

      logger.info("still logged");
      logger.error("still logged too");

      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });
});
