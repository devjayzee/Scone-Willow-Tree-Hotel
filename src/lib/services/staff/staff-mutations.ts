import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { BCRYPT_COST } from "@/lib/constants/auth";
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
} from "../audit-service";
import {
  issueSetupTokenForUser,
  voidActiveTokens,
} from "../password-reset-service";
import { normalizeEmail } from "@/lib/validations/email";
import { staffSelectFieldsMinimal } from "./staff-constants";
import { logStaffUpdateAudits } from "./staff-audit";

/**
 * Create a new staff member via the invite flow.
 *
 * The account is created inactive with a placeholder password hash;
 * consumeSetupToken flips isActive to true and sets the real password
 * when the invited user completes /setup-password. Login against the
 * placeholder is impossible on two axes (bcrypt.compare fails against
 * an unknown-plaintext hash AND authorize short-circuits on
 * !isActive), so no schema migration to nullable password is needed.
 *
 * Returns both the created row AND the raw setup token — the caller
 * (POST /api/staffs route) uses the token to render the invite URL for
 * the email, but the token is NEVER surfaced in the API response.
 *
 * @throws ConflictError if email already exists
 */
type MinimalStaff = Prisma.UserGetPayload<{
  select: typeof staffSelectFieldsMinimal;
}>;

export async function createStaff(
  data: CreateStaffSchemaInput,
  performedBy?: string
): Promise<{ staff: MinimalStaff; setupToken: string }> {
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new ConflictError("Email already exists");
  }

  // Per-user random placeholder hash. Previously all pending
  // invitees shared DUMMY_PASSWORD_HASH, a value known to every reader
  // of this repo. A pending user cannot be made active today:
  // updateStaff refuses isActive: true on a pending row, and the
  // User_setupPending_inactive_check constraint rejects it in the
  // database. The random hash stays as defence in depth, so each
  // pending account still cannot be logged into if both guards fail.
  // consumeSetupToken overwrites this with the user's real password.
  const placeholderPassword = randomBytes(24).toString("base64url");
  const placeholderHash = await bcrypt.hash(placeholderPassword, BCRYPT_COST);

  const staff = await prisma.user.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: placeholderHash,
      role: data.role ?? "STAFF",
      isActive: false,
      setupPending: true,
    },
    select: staffSelectFieldsMinimal,
  });

  const setupToken = await issueSetupTokenForUser(staff.id);

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

  return { staff, setupToken };
}

/**
 * Reissue a setup invite for a pending invite only.
 * issueSetupTokenForUser voids any prior unused SETUP token for this
 * user by design, so the old link 404s the moment this succeeds.
 *
 * @throws NotFoundError if user missing
 * @throws BusinessRuleError if there is no pending invite (deactivated or setup already completed)
 */
export async function resendInvite(
  userId: string,
  performedBy: string
): Promise<{
  user: { id: string; email: string; firstName: string };
  setupToken: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      isActive: true,
      setupPending: true,
    },
  });

  if (!user) {
    throw new NotFoundError("Staff not found");
  }

  if (!user.setupPending) {
    throw new BusinessRuleError(
      user.isActive
        ? "Cannot resend invite: this staff member has already completed setup"
        : "This account has been deactivated. Use Activate to restore access."
    );
  }

  const setupToken = await issueSetupTokenForUser(user.id);

  await createAuditLog(
    performedBy,
    AuditAction.STAFF_INVITE_RESENT,
    EntityType.STAFF,
    user.id,
    { reason: "Setup invite reissued via manager action" }
  );

  return {
    user: { id: user.id, email: user.email, firstName: user.firstName },
    setupToken,
  };
}

/**
 * Update an existing staff member
 * @throws NotFoundError if staff member not found
 * @throws ConflictError if new email already exists
 * @throws BusinessRuleError if the caller tries to change their own role or deactivate themselves
 */
export async function updateStaff(
  id: string,
  data: UpdateStaffSchemaInput,
  currentUserId: string
) {
  const existingStaff = await prisma.user.findUnique({
    where: { id },
  });

  if (!existingStaff) {
    throw new NotFoundError("Staff not found");
  }

  if (id === currentUserId) {
    if (data.role !== undefined && data.role !== existingStaff.role) {
      throw new BusinessRuleError("Cannot change your own role");
    }
    if (data.isActive === false) {
      throw new BusinessRuleError("Cannot deactivate your own account");
    }
  }

  if (data.isActive === true && existingStaff.setupPending) {
    throw new BusinessRuleError(
      "This person has not set up their account yet. Use Resend invite."
    );
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

  // Build update data. GMs cannot set another user's password directly:
  // rotation goes through /reset-password, which is also the
  // only writer that bumps tokenVersion (to revoke stolen JWTs after a
  // credential change). Role and isActive changes intentionally do NOT
  // bump tokenVersion: the jwt callback in @/lib/auth rehydrates role
  // (and firstName) from the DB on every session poll, so demotion /
  // promotion / rename take effect within the poll interval without
  // forcing a re-login. Deactivation is caught by the same callback's
  // isActive check. Do not add a tokenVersion write here.
  const updateData: {
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: "GENERAL_MANAGER" | "MANAGER" | "STAFF";
    isActive?: boolean;
  } = {};

  if (data.firstName) updateData.firstName = data.firstName;
  if (data.lastName) updateData.lastName = data.lastName;
  if (data.email) updateData.email = data.email;
  if (data.role) updateData.role = data.role;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  // An email change cancels outstanding setup/reset links sent to the
  // old address, atomically with the update.
  const emailChanged =
    data.email !== undefined &&
    normalizeEmail(data.email) !== normalizeEmail(existingStaff.email);

  const { staff, voidedCount } = await prisma.$transaction(async (tx) => {
    // Void tokens before the user update: consumeToken locks token then
    // user, so the same order avoids a deadlock with a concurrent redemption.
    const voidedCount = emailChanged
      ? (await voidActiveTokens(id, "SETUP", tx)) +
        (await voidActiveTokens(id, "RESET", tx))
      : 0;
    const staff = await tx.user.update({
      where: { id },
      data: updateData,
      select: staffSelectFieldsMinimal,
    });
    return { staff, voidedCount };
  });

  await logStaffUpdateAudits(id, existingStaff, data, currentUserId);

  if (voidedCount > 0) {
    await createAuditLog(
      currentUserId,
      AuditAction.STAFF_TOKENS_VOIDED,
      EntityType.STAFF,
      id,
      {
        previous: { email: existingStaff.email },
        current: { email: data.email },
        reason: `Email changed; ${voidedCount} unused setup/reset link(s) cancelled`,
      }
    );
  }

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

