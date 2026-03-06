/**
 * Custom error classes for the application.
 * These provide typed errors that can be caught and handled appropriately
 * in API routes and service layers.
 */

/**
 * Base application error class.
 * All custom errors extend this for consistent error handling.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Thrown when a requested resource is not found.
 * Maps to HTTP 404 Not Found.
 */
export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

/**
 * Thrown when an operation conflicts with existing data.
 * Maps to HTTP 409 Conflict.
 * Examples: duplicate unique field, concurrent modification
 */
export class ConflictError extends AppError {
  constructor(message: string = "Resource conflict") {
    super(message, 409, "CONFLICT");
  }
}

/**
 * Thrown when input validation fails.
 * Maps to HTTP 400 Bad Request.
 */
export class ValidationError extends AppError {
  constructor(
    message: string = "Validation failed",
    public readonly details?: Record<string, string[]>
  ) {
    super(message, 400, "VALIDATION_ERROR");
  }
}

/**
 * Thrown when authentication is required but not provided.
 * Maps to HTTP 401 Unauthorized.
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

/**
 * Thrown when the user lacks permission for an action.
 * Maps to HTTP 403 Forbidden.
 */
export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

/**
 * Thrown when a business rule is violated.
 * Maps to HTTP 400 Bad Request.
 * Examples: cannot delete room with active bookings
 */
export class BusinessRuleError extends AppError {
  constructor(message: string) {
    super(message, 400, "BUSINESS_RULE_VIOLATION");
  }
}
