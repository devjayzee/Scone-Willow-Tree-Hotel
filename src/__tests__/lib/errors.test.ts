import { describe, it, expect } from "vitest";
import {
  AppError,
  NotFoundError,
  ConflictError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  BusinessRuleError,
} from "@/lib/errors";

describe("Error Classes", () => {
  // ============================================================
  // AppError (Base Class)
  // ============================================================
  describe("AppError", () => {
    it("should create error with default values", () => {
      const error = new AppError("Test error");
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(500);
      expect(error.code).toBeUndefined();
      expect(error.name).toBe("AppError");
    });

    it("should create error with custom status code", () => {
      const error = new AppError("Custom error", 418);
      expect(error.statusCode).toBe(418);
    });

    it("should create error with custom code", () => {
      const error = new AppError("Coded error", 500, "CUSTOM_CODE");
      expect(error.code).toBe("CUSTOM_CODE");
    });

    it("should be instanceof Error", () => {
      const error = new AppError("Test");
      expect(error).toBeInstanceOf(Error);
    });

    it("should have proper stack trace", () => {
      const error = new AppError("Test");
      expect(error.stack).toBeDefined();
    });
  });

  // ============================================================
  // NotFoundError
  // ============================================================
  describe("NotFoundError", () => {
    it("should create with default message", () => {
      const error = new NotFoundError();
      expect(error.message).toBe("Resource not found");
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe("NOT_FOUND");
      expect(error.name).toBe("NotFoundError");
    });

    it("should create with custom message", () => {
      const error = new NotFoundError("User not found");
      expect(error.message).toBe("User not found");
      expect(error.statusCode).toBe(404);
    });

    it("should be instanceof AppError", () => {
      const error = new NotFoundError();
      expect(error).toBeInstanceOf(AppError);
    });
  });

  // ============================================================
  // ConflictError
  // ============================================================
  describe("ConflictError", () => {
    it("should create with default message", () => {
      const error = new ConflictError();
      expect(error.message).toBe("Resource conflict");
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe("CONFLICT");
      expect(error.name).toBe("ConflictError");
    });

    it("should create with custom message", () => {
      const error = new ConflictError("Email already exists");
      expect(error.message).toBe("Email already exists");
    });

    it("should be instanceof AppError", () => {
      const error = new ConflictError();
      expect(error).toBeInstanceOf(AppError);
    });
  });

  // ============================================================
  // ValidationError
  // ============================================================
  describe("ValidationError", () => {
    it("should create with default message", () => {
      const error = new ValidationError();
      expect(error.message).toBe("Validation failed");
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.name).toBe("ValidationError");
    });

    it("should create with custom message", () => {
      const error = new ValidationError("Invalid input");
      expect(error.message).toBe("Invalid input");
    });

    it("should store validation details", () => {
      const details = {
        email: ["Email is required", "Email must be valid"],
        password: ["Password is too short"],
      };
      const error = new ValidationError("Validation failed", details);
      expect(error.details).toEqual(details);
    });

    it("should be instanceof AppError", () => {
      const error = new ValidationError();
      expect(error).toBeInstanceOf(AppError);
    });
  });

  // ============================================================
  // UnauthorizedError
  // ============================================================
  describe("UnauthorizedError", () => {
    it("should create with default message", () => {
      const error = new UnauthorizedError();
      expect(error.message).toBe("Unauthorized");
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe("UNAUTHORIZED");
      expect(error.name).toBe("UnauthorizedError");
    });

    it("should create with custom message", () => {
      const error = new UnauthorizedError("Invalid token");
      expect(error.message).toBe("Invalid token");
    });

    it("should be instanceof AppError", () => {
      const error = new UnauthorizedError();
      expect(error).toBeInstanceOf(AppError);
    });
  });

  // ============================================================
  // ForbiddenError
  // ============================================================
  describe("ForbiddenError", () => {
    it("should create with default message", () => {
      const error = new ForbiddenError();
      expect(error.message).toBe("Forbidden");
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe("FORBIDDEN");
      expect(error.name).toBe("ForbiddenError");
    });

    it("should create with custom message", () => {
      const error = new ForbiddenError("Access denied");
      expect(error.message).toBe("Access denied");
    });

    it("should be instanceof AppError", () => {
      const error = new ForbiddenError();
      expect(error).toBeInstanceOf(AppError);
    });
  });

  // ============================================================
  // BusinessRuleError
  // ============================================================
  describe("BusinessRuleError", () => {
    it("should create with message", () => {
      const error = new BusinessRuleError("Cannot delete room with active bookings");
      expect(error.message).toBe("Cannot delete room with active bookings");
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("BUSINESS_RULE_VIOLATION");
      expect(error.name).toBe("BusinessRuleError");
    });

    it("should be instanceof AppError", () => {
      const error = new BusinessRuleError("Test");
      expect(error).toBeInstanceOf(AppError);
    });
  });

  // ============================================================
  // Error Type Checking
  // ============================================================
  describe("Error Type Checking", () => {
    it("should differentiate error types", () => {
      const notFound = new NotFoundError();
      const conflict = new ConflictError();
      const validation = new ValidationError();
      const unauthorized = new UnauthorizedError();
      const forbidden = new ForbiddenError();
      const businessRule = new BusinessRuleError("test");

      expect(notFound).toBeInstanceOf(NotFoundError);
      expect(notFound).not.toBeInstanceOf(ConflictError);

      expect(conflict).toBeInstanceOf(ConflictError);
      expect(conflict).not.toBeInstanceOf(ValidationError);

      expect(validation).toBeInstanceOf(ValidationError);
      expect(unauthorized).toBeInstanceOf(UnauthorizedError);
      expect(forbidden).toBeInstanceOf(ForbiddenError);
      expect(businessRule).toBeInstanceOf(BusinessRuleError);
    });

    it("all errors should be AppError instances", () => {
      const errors = [
        new NotFoundError(),
        new ConflictError(),
        new ValidationError(),
        new UnauthorizedError(),
        new ForbiddenError(),
        new BusinessRuleError("test"),
      ];

      errors.forEach(error => {
        expect(error).toBeInstanceOf(AppError);
        expect(error).toBeInstanceOf(Error);
      });
    });
  });
});
