import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  AppError,
  NotFoundError,
  ConflictError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  BusinessRuleError,
  RateLimitError,
} from "./errors";
import { logger } from "./logger";

/**
 * Standard API error response format.
 */
export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, string[]>;
}

/**
 * Handles errors in API routes and returns appropriate NextResponse.
 *
 * @param error - The error to handle
 * @param context - Optional context for logging (e.g., "creating room")
 * @returns NextResponse with appropriate status code and error message
 *
 * @example
 * ```ts
 * export async function POST(request: Request) {
 *   try {
 *     // ... your code
 *   } catch (error) {
 *     return handleApiError(error, "creating booking");
 *   }
 * }
 * ```
 */
export function handleApiError(
  error: unknown,
  context?: string
): NextResponse<ApiErrorResponse> {
  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const details: Record<string, string[]> = {};
    error.issues.forEach((issue) => {
      const path = issue.path.join(".") || "value";
      if (!details[path]) {
        details[path] = [];
      }
      details[path].push(issue.message);
    });

    return NextResponse.json(
      {
        error: error.issues[0]?.message || "Validation failed",
        code: "VALIDATION_ERROR",
        details,
      },
      { status: 400 }
    );
  }

  // Handle custom AppError types
  if (error instanceof AppError) {
    const response: ApiErrorResponse = {
      error: error.message,
      code: error.code,
    };

    if (error instanceof ValidationError && error.details) {
      response.details = error.details;
    }

    return NextResponse.json(response, { status: error.statusCode });
  }

  // Log unexpected errors
  logger.error("Unexpected API error", error, { context });

  // Return generic error for unknown errors (don't leak internal details)
  return NextResponse.json(
    {
      error: context ? `Failed ${context}` : "An unexpected error occurred",
      code: "INTERNAL_ERROR",
    },
    { status: 500 }
  );
}

/**
 * Type guard to check if an error is an AppError.
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Re-export error classes for convenience.
 */
export {
  AppError,
  NotFoundError,
  ConflictError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  BusinessRuleError,
  RateLimitError,
};
