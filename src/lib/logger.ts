/**
 * Centralized logging utility.
 *
 * Provides structured logging that can be extended to integrate with
 * external services like Sentry, LogRocket, or Datadog.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

interface Logger {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, error?: unknown, context?: LogContext) => void;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Minimum log level (can be configured via env)
const MIN_LOG_LEVEL = process.env.NODE_ENV === "production" ? "info" : "debug";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LOG_LEVEL as LogLevel];
}

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
}

/**
 * Logger instance with methods for each log level.
 *
 * Usage:
 * ```ts
 * import { logger } from "@/lib/logger";
 *
 * logger.info("User logged in", { userId: "123" });
 * logger.error("Failed to process booking", error, { bookingId: "456" });
 * ```
 */
export const logger: Logger = {
  debug(message: string, context?: LogContext) {
    if (shouldLog("debug")) {
      console.debug(formatMessage("debug", message, context));
    }
  },

  info(message: string, context?: LogContext) {
    if (shouldLog("info")) {
      console.info(formatMessage("info", message, context));
    }
  },

  warn(message: string, context?: LogContext) {
    if (shouldLog("warn")) {
      console.warn(formatMessage("warn", message, context));
    }
  },

  error(message: string, error?: unknown, context?: LogContext) {
    if (shouldLog("error")) {
      const errorContext = {
        ...context,
        ...(error instanceof Error && {
          errorName: error.name,
          errorMessage: error.message,
          stack: error.stack,
        }),
      };
      console.error(formatMessage("error", message, errorContext));
    }
  },
};
