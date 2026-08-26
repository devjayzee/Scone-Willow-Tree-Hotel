import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import {
  handleApiError,
  AppError,
  NotFoundError,
  ConflictError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  BusinessRuleError,
} from "@/lib/api-error-handler";

// Mock the logger to avoid console output during tests
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("API Error Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // handleApiError - Zod Errors
  // ============================================================
  describe("handleApiError - ZodError", () => {
    it("should handle single ZodError", async () => {
      const schema = z.object({
        email: z.string().email(),
      });

      try {
        schema.parse({ email: "invalid" });
      } catch (error) {
        const response = handleApiError(error);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.code).toBe("VALIDATION_ERROR");
        expect(data.details).toBeDefined();
        expect(data.details.email).toBeDefined();
      }
    });

    it("should handle multiple ZodErrors", async () => {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(8),
      });

      try {
        schema.parse({ email: "invalid", password: "short" });
      } catch (error) {
        const response = handleApiError(error);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.code).toBe("VALIDATION_ERROR");
        expect(data.details.email).toBeDefined();
        expect(data.details.password).toBeDefined();
      }
    });

    it("should handle nested path ZodErrors", async () => {
      const schema = z.object({
        user: z.object({
          email: z.string().email(),
        }),
      });

      try {
        schema.parse({ user: { email: "invalid" } });
      } catch (error) {
        const response = handleApiError(error);
        const data = await response.json();

        expect(data.details["user.email"]).toBeDefined();
      }
    });
  });

  // ============================================================
  // handleApiError - AppError Types
  // ============================================================
  describe("handleApiError - AppError types", () => {
    it("should handle NotFoundError", async () => {
      const error = new NotFoundError("Room not found");
      const response = handleApiError(error);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Room not found");
      expect(data.code).toBe("NOT_FOUND");
    });

    it("should handle ConflictError", async () => {
      const error = new ConflictError("Email already exists");
      const response = handleApiError(error);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe("Email already exists");
      expect(data.code).toBe("CONFLICT");
    });

    it("should handle ValidationError without details", async () => {
      const error = new ValidationError("Invalid input");
      const response = handleApiError(error);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid input");
      expect(data.code).toBe("VALIDATION_ERROR");
      expect(data.details).toBeUndefined();
    });

    it("should handle ValidationError with details", async () => {
      const details = { field: ["Error 1", "Error 2"] };
      const error = new ValidationError("Validation failed", details);
      const response = handleApiError(error);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.details).toEqual(details);
    });

    it("should handle UnauthorizedError", async () => {
      const error = new UnauthorizedError("Invalid token");
      const response = handleApiError(error);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Invalid token");
      expect(data.code).toBe("UNAUTHORIZED");
    });

    it("should handle ForbiddenError", async () => {
      const error = new ForbiddenError("Access denied");
      const response = handleApiError(error);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Access denied");
      expect(data.code).toBe("FORBIDDEN");
    });

    it("should handle BusinessRuleError", async () => {
      const error = new BusinessRuleError("Cannot delete room with bookings");
      const response = handleApiError(error);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cannot delete room with bookings");
      expect(data.code).toBe("BUSINESS_RULE_VIOLATION");
    });

    it("should handle generic AppError", async () => {
      const error = new AppError("Custom error", 418, "TEAPOT");
      const response = handleApiError(error);
      const data = await response.json();

      expect(response.status).toBe(418);
      expect(data.error).toBe("Custom error");
      expect(data.code).toBe("TEAPOT");
    });
  });

  // ============================================================
  // handleApiError - Unknown Errors
  // ============================================================
  describe("handleApiError - Unknown errors", () => {
    it("should handle generic Error", async () => {
      const error = new Error("Something went wrong");
      const response = handleApiError(error);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("An unexpected error occurred");
      expect(data.code).toBe("INTERNAL_ERROR");
    });

    it("should include context in error message when provided", async () => {
      const error = new Error("Database error");
      const response = handleApiError(error, "creating booking");
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed creating booking");
    });

    it("should handle string error", async () => {
      const response = handleApiError("String error");
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe("INTERNAL_ERROR");
    });

    it("should handle null error", async () => {
      const response = handleApiError(null);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe("INTERNAL_ERROR");
    });

    it("should handle undefined error", async () => {
      const response = handleApiError(undefined);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe("INTERNAL_ERROR");
    });

    it("should handle object error", async () => {
      const response = handleApiError({ message: "Object error" });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe("INTERNAL_ERROR");
    });
  });
});
