import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import type {
  CreateStaffSchemaInput,
  UpdateStaffSchemaInput,
} from "@/lib/validations/staff";
import { NotFoundError, ConflictError, BusinessRuleError } from "@/lib/errors";
import {
  createAuditLog,
  AuditAction,
  EntityType,
  sanitizeForAudit,
  getChangedFields,
} from "../audit-service";
import { staffSelectFieldsMinimal } from "./staff-constants";

/**
 * Create a new staff member
 * @throws ConflictError if email already exists
 */
export async function createStaff(
  data: CreateStaffSchemaInput,
  performedBy?: string
) {
  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new ConflictError("Email already exists");
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(data.password, 10);

  const staff = await prisma.user.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: hashedPassword,
      role: data.role ?? "STAFF",
    },
    select: staffSelectFieldsMinimal,
  });

  // Audit log
  if (performedBy) {
    await createAuditLog(
      performedBy,
      AuditAction.STAFF_CREATED,
      EntityType.STAFF,
      staff.id,
      {
        current: sanitizeForAudit({
          firstName: staff.firstName,
          lastName: staff.lastName,
          email: staff.email,
          role: staff.role,
        }),
      }
    );
  }

  return staff;
}

/**
 * Update an existing staff member
 * @throws NotFoundError if staff member not found
 * @throws ConflictError if new email already exists
 */
export async function updateStaff(
  id: string,
  data: UpdateStaffSchemaInput,
  performedBy?: string
) {
  const existingStaff = await prisma.user.findUnique({
    where: { id },
  });

  if (!existingStaff) {
    throw new NotFoundError("Staff not found");
  }

  // Check if updating email conflicts with another user
  if (data.email && data.email !== existingStaff.email) {
    const emailConflict = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (emailConflict) {
      throw new ConflictError("Email already exists");
    }
  }

  // Build update data
  const updateData: {
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    role?: "GENERAL_MANAGER" | "MANAGER" | "STAFF";
    isActive?: boolean;
    tokenVersion?: { increment: number };
  } = {};

  if (data.firstName) updateData.firstName = data.firstName;
  if (data.lastName) updateData.lastName = data.lastName;
  if (data.email) updateData.email = data.email;
  if (data.role) updateData.role = data.role;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  // Hash password if provided and increment tokenVersion to invalidate sessions
  if (data.password) {
    updateData.password = await bcrypt.hash(data.password, 10);
    updateData.tokenVersion = { increment: 1 };
  }

  const staff = await prisma.user.update({
    where: { id },
    data: updateData,
    select: staffSelectFieldsMinimal,
  });

  await logStaffUpdateAudits(id, existingStaff, data, performedBy);

  return staff;
}

/**
 * Delete result type
 */
export interface DeleteStaffResult {
  deleted: boolean;
  deactivated: boolean;
  message: string;
}

/**
 * Delete a staff member
 * - If staff has active bookings, deactivates instead of deleting
 * - Prevents self-deletion
 * @throws NotFoundError if staff member not found
 * @throws BusinessRuleError if attempting to delete own account
 */
export async function deleteStaff(
  id: string,
  currentUserId: string
): Promise<DeleteStaffResult> {
  // Prevent self-deletion
  if (id === currentUserId) {
    throw new BusinessRuleError("Cannot delete your own account");
  }

  const staff = await prisma.user.findUnique({
    where: { id },
    include: {
      bookings: {
        where: {
          status: { in: ["CONFIRMED", "CHECKED_IN"] },
        },
      },
    },
  });

  if (!staff) {
    throw new NotFoundError("Staff not found");
  }

  // If staff has active bookings, deactivate instead of delete
  if (staff.bookings.length > 0) {
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    // Audit log for deactivation
    await createAuditLog(
      currentUserId,
      AuditAction.STAFF_DEACTIVATED,
      EntityType.STAFF,
      id,
      {
        reason: "Deactivated instead of deleted (has active bookings)",
        current: { isActive: false, activeBookings: staff.bookings.length },
      }
    );

    return {
      deleted: false,
      deactivated: true,
      message: "Staff deactivated (has active bookings)",
    };
  }

  await prisma.user.delete({
    where: { id },
  });

  // Audit log for deletion
  await createAuditLog(
    currentUserId,
    AuditAction.STAFF_DELETED,
    EntityType.STAFF,
    id,
    {
      previous: sanitizeForAudit({
        firstName: staff.firstName,
        lastName: staff.lastName,
        email: staff.email,
        role: staff.role,
      }),
    }
  );

  return {
    deleted: true,
    deactivated: false,
    message: "Staff deleted successfully",
  };
}

/**
 * Classify what changed on a staff update and write the matching audit entries.
 * Fires nothing when performedBy is undefined. Preserves the four-way branching
 * originally inlined in updateStaff: password / role / active-status / general.
 */
async function logStaffUpdateAudits(
  id: string,
  existingStaff: Record<string, unknown>,
  data: UpdateStaffSchemaInput,
  performedBy?: string
): Promise<void> {
  if (!performedBy) return;

  const passwordChanged = !!data.password;
  const roleChanged = data.role && data.role !== existingStaff.role;
  const activeStatusChanged =
    data.isActive !== undefined && data.isActive !== existingStaff.isActive;

  if (passwordChanged) {
    await createAuditLog(
      performedBy,
      AuditAction.STAFF_PASSWORD_CHANGED,
      EntityType.STAFF,
      id,
      { reason: "Password updated" }
    );
  }

  if (roleChanged) {
    await createAuditLog(
      performedBy,
      AuditAction.STAFF_ROLE_CHANGED,
      EntityType.STAFF,
      id,
      {
        previous: { role: existingStaff.role },
        current: { role: data.role },
      }
    );
  }

  if (activeStatusChanged) {
    await createAuditLog(
      performedBy,
      data.isActive
        ? AuditAction.STAFF_ACTIVATED
        : AuditAction.STAFF_DEACTIVATED,
      EntityType.STAFF,
      id,
      {
        previous: { isActive: existingStaff.isActive },
        current: { isActive: data.isActive },
      }
    );
  }

  const changedFields = getChangedFields(
    existingStaff,
    data as Record<string, unknown>
  );

  if (
    changedFields.length > 0 &&
    !passwordChanged &&
    !roleChanged &&
    !activeStatusChanged
  ) {
    await createAuditLog(
      performedBy,
      AuditAction.STAFF_UPDATED,
      EntityType.STAFF,
      id,
      {
        previous: sanitizeForAudit(
          Object.fromEntries(
            changedFields.map((f) => [f, existingStaff[f]])
          )
        ),
        current: sanitizeForAudit(
          Object.fromEntries(
            changedFields.map((f) => [f, (data as Record<string, unknown>)[f]])
          )
        ),
        changedFields,
      }
    );
  }
}
