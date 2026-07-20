/**
 * Staff Service
 *
 * This file re-exports from the modular staff service for backwards compatibility.
 * For new code, consider importing directly from '@/lib/services/staff'.
 *
 * @module staff-service
 * @see {@link ./staff/index.ts} for the modular implementation
 */

export {
  // Error types
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  // Types
  type DeleteStaffResult,
  // Queries
  getAllStaff,
  getStaffById,
  // Mutations
  createStaff,
  updateStaff,
  deleteStaff,
} from "./staff";
