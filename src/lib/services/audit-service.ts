import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getAuditContext } from "./audit-context";

/**
 * Audit action types for staff management.
 */
export const AuditAction = {
  // Staff actions
  STAFF_CREATED: "STAFF_CREATED",
  STAFF_UPDATED: "STAFF_UPDATED",
  STAFF_DELETED: "STAFF_DELETED",
  STAFF_DEACTIVATED: "STAFF_DEACTIVATED",
  STAFF_ACTIVATED: "STAFF_ACTIVATED",
  STAFF_PASSWORD_RESET: "STAFF_PASSWORD_RESET",
  STAFF_PASSWORD_SETUP: "STAFF_PASSWORD_SETUP",
  STAFF_INVITE_RESENT: "STAFF_INVITE_RESENT",
  STAFF_ROLE_CHANGED: "STAFF_ROLE_CHANGED",

  // Room actions (for future use)
  ROOM_CREATED: "ROOM_CREATED",
  ROOM_UPDATED: "ROOM_UPDATED",
  ROOM_DELETED: "ROOM_DELETED",

  // Booking actions
  BOOKING_CREATED: "BOOKING_CREATED",
  BOOKING_UPDATED: "BOOKING_UPDATED",
  BOOKING_DELETED: "BOOKING_DELETED",
  BOOKING_CANCELLED: "BOOKING_CANCELLED",
  BOOKING_CHECKED_IN: "BOOKING_CHECKED_IN",
  BOOKING_CHECKED_OUT: "BOOKING_CHECKED_OUT",
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

/**
 * Entity types for audit logging.
 */
export const EntityType = {
  STAFF: "STAFF",
  ROOM: "ROOM",
  BOOKING: "BOOKING",
} as const;

export type EntityTypeValue = (typeof EntityType)[keyof typeof EntityType];

/**
 * Audit log entry details.
 */
export interface AuditDetails {
  // Previous values (for updates)
  previous?: Record<string, unknown>;
  // New values (for creates/updates)
  current?: Record<string, unknown>;
  // Changed fields (for updates)
  changedFields?: string[];
  // Additional context
  reason?: string;
  // IP address (if available)
  ipAddress?: string;
  // User agent (if available)
  userAgent?: string;
}

/**
 * Create an audit log entry.
 *
 * @param userId - ID of the user performing the action
 * @param action - The action being performed
 * @param entityType - Type of entity being acted upon
 * @param entityId - ID of the entity being acted upon
 * @param details - Additional details about the action
 */
export async function createAuditLog(
  userId: string,
  action: AuditActionType,
  entityType: EntityTypeValue,
  entityId: string,
  details?: AuditDetails
): Promise<void> {
  // Merge request-scoped forensics from AsyncLocalStorage. Route
  // handlers wrap their body in `runWithAuditContext` to make ipAddress /
  // userAgent implicitly available without threading them through every
  // service function.
  const requestCtx = getAuditContext();
  const mergedDetails: AuditDetails | undefined =
    requestCtx && (requestCtx.ipAddress || requestCtx.userAgent)
      ? {
          ...(details ?? {}),
          ...(requestCtx.ipAddress && { ipAddress: requestCtx.ipAddress }),
          ...(requestCtx.userAgent && { userAgent: requestCtx.userAgent }),
        }
      : details;

  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        details: mergedDetails ? JSON.parse(JSON.stringify(mergedDetails)) : null,
      },
    });
  } catch (error) {
    // Log error but don't fail the main operation
    logger.error("Failed to create audit log", error, { userId, action, entityType, entityId });
  }
}

/**
 * Helper to sanitize sensitive data before logging.
 * Removes passwords and other sensitive fields.
 */
export function sanitizeForAudit<T extends Record<string, unknown>>(
  data: T,
  sensitiveFields: string[] = ["password", "token", "secret"]
): Partial<T> {
  const sanitized = { ...data };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      delete sanitized[field];
    }
  }

  return sanitized;
}

/**
 * Helper to compute changed fields between two objects.
 */
export function getChangedFields<T extends Record<string, unknown>>(
  previous: T,
  current: Partial<T>,
  ignoreFields: string[] = ["updatedAt", "password"]
): string[] {
  const changedFields: string[] = [];

  for (const key of Object.keys(current)) {
    if (ignoreFields.includes(key)) continue;

    if (current[key] !== undefined && current[key] !== previous[key]) {
      changedFields.push(key);
    }
  }

  return changedFields;
}
