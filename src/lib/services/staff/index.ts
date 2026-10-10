/**
 * Staff Service Module
 *
 * Organized by concern:
 * - staff-queries: Read operations (getAllStaff, getStaffById)
 * - staff-mutations: Write operations (createStaff, updateStaff, deleteStaff)
 * - staff-invites: Invite flow (inviteStaff, resendInvite)
 * - staff-constants: Shared select-field shapes
 */

// Re-export error types for convenience
export { NotFoundError, ConflictError, BusinessRuleError } from "@/lib/errors";

// Export types
export type { DeleteStaffResult } from "./staff-mutations";

// Export queries
export { getAllStaff, getStaffById } from "./staff-queries";

// Export mutations
export { updateStaff, deleteStaff } from "./staff-mutations";

// Export invites
export { inviteStaff, resendInvite } from "./staff-invites";
