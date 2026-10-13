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
import { revokeTrustedDevices } from "@/lib/services/rate-limit-service";
import { staffSelectFieldsMinimal } from "./staff-constants";
import { logStaffUpdateAudits } from "./staff-audit";
import {
  assertAllowedRecipient,
  spendInviteLimit,
} from "./staff-invite-limits";

/** Random, unknown-plaintext bcrypt hash: nobody can log in against it. */
async function newPlaceholderHash(): Promise<string> {
  const placeholderPassword = randomBytes(24).toString("base64url");
  return bcrypt.hash(placeholderPassword, BCRYPT_COST);
}

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
 * Returns both the created row AND the raw setup token. The only caller,
 * inviteStaff (the invite flow), uses the token to build the invite
 * email, and the token is NEVER surfaced in the API response.
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
  const placeholderHash = await newPlaceholderHash();

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
 * Update an existing staff member
 * @throws NotFoundError if staff member not found
 * @throws ConflictError if new email already exists
 * @throws ValidationError if a changed email is outside the recipient-domain allowlist
 * @throws RateLimitError if an email change is past the per-GM or deployment-wide invite limit
 * @throws BusinessRuleError if the caller tries to change their own role or deactivate themselves,
 *   or sends isActive together with an email change that resets access
 *
 * Changing the email of a set-up account that is not the caller's own resets
 * access: new placeholder password, tokenVersion + 1, back to Pending.
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

  // Drives the recipient-allowlist check, the invite-limit spend, and
  // voiding the old address's setup/reset links.
  const emailChanged =
    data.email !== undefined &&
    normalizeEmail(data.email) !== normalizeEmail(existingStaff.email);

  // A set-up account (not the caller's own) gets a new email: the old holder
  // may be the wrong person, so their session and password must stop working.
  const resetsAccess =
    emailChanged && !existingStaff.setupPending && id !== currentUserId;

  if (resetsAccess && data.isActive !== undefined) {
    throw new BusinessRuleError(
      "Change the email on its own. The account will need a new invite."
    );
  }

  // Same recipient-domain gate as invites. Only a changed email is checked,
  // so legacy accounts on other domains can still be edited.
  if (emailChanged) {
    assertAllowedRecipient(data.email!);
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

  // A changed address can receive password-reset mail, so it spends the same
  // invite budget (per-GM and deployment-wide). A refusal writes nothing.
  if (emailChanged) {
    await spendInviteLimit(
      currentUserId,
      "Too many email changes. Try again later."
    );
  }

  // Trusted devices stop counting on an email change (new address) or any
  // real isActive change (deactivation or reactivation). Before the
  // transaction: a Redis failure aborts the write.
  if (emailChanged) {
    await revokeTrustedDevices(data.email!);
  } else if (
    data.isActive !== undefined &&
    data.isActive !== existingStaff.isActive
  ) {
    await revokeTrustedDevices(existingStaff.email);
  }

  // The placeholder hash is built before the transaction (bcrypt is slow).
  const placeholderHash = resetsAccess ? await newPlaceholderHash() : null;

  // Build update data. GMs cannot set another user's password directly.
  // tokenVersion is bumped only on a credential change (to revoke stolen
  // JWTs): a password write in /reset-password or setup, or the access
  // reset below, which replaces the password. Role, name and isActive
  // changes intentionally do NOT bump it: the jwt callback in @/lib/auth
  // rehydrates role (and firstName) from the DB on every session poll, so
  // they take effect within the poll interval without forcing a re-login,
  // and deactivation is caught by the same callback's isActive check.
  const updateData: {
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: "GENERAL_MANAGER" | "MANAGER" | "STAFF";
    isActive?: boolean;
    password?: string;
    tokenVersion?: { increment: number };
    setupPending?: boolean;
  } = {};

  if (data.firstName) updateData.firstName = data.firstName;
  if (data.lastName) updateData.lastName = data.lastName;
  if (data.email) updateData.email = data.email;
  if (data.role) updateData.role = data.role;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (placeholderHash) {
    updateData.password = placeholderHash;
    updateData.tokenVersion = { increment: 1 };
    updateData.setupPending = true;
    updateData.isActive = false;
  }

  let result: { staff: MinimalStaff; voidedCount: number };
  try {
    result = await prisma.$transaction(async (tx) => {
      // An email change cancels outstanding setup/reset links sent to the old
      // address, atomically with the update.
      // Void tokens before the user update: consumeToken locks token then
      // user, so the same order avoids a deadlock with a concurrent redemption.
      const voidedCount = emailChanged
        ? (await voidActiveTokens(id, "SETUP", tx)) +
          (await voidActiveTokens(id, "RESET", tx))
        : 0;
      // The where carries setupPending so the write only lands if the account
      // is still in the state read above. If the invitee redeemed their link
      // in between, resetsAccess was decided on a stale row: no row matches
      // (P2025), the transaction rolls back and the GM retries.
      const staff = await tx.user.update({
        where: { id, setupPending: existingStaff.setupPending },
        data: updateData,
        select: staffSelectFieldsMinimal,
      });
      return { staff, voidedCount };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new ConflictError(
        "This account changed while you were editing. Try again."
      );
    }
    throw error;
  }
  const { staff, voidedCount } = result;

  await logStaffUpdateAudits(id, existingStaff, data, currentUserId);

  if (resetsAccess) {
    await createAuditLog(
      currentUserId,
      AuditAction.STAFF_ACCESS_RESET,
      EntityType.STAFF,
      id,
      {
        previous: {
          email: existingStaff.email,
          isActive: existingStaff.isActive,
          setupPending: false,
          role: existingStaff.role,
        },
        current: {
          email: data.email,
          isActive: false,
          setupPending: true,
          role: data.role ?? existingStaff.role,
        },
        reason: "Email changed on a set-up account; access reset until a new invite is redeemed",
      }
    );
  }

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
 * - If staff has any bookings, deactivates instead of deleting
 * - Prevents self-deletion
 * @throws NotFoundError if staff member not found
 * @throws BusinessRuleError if attempting to delete own account
 * @throws ConflictError if a booking is created between the check and the delete
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
    include: { _count: { select: { bookings: true } } },
  });

  if (!staff) {
    throw new NotFoundError("Staff not found");
  }

  // If staff has any bookings, deactivate instead of delete
  if (staff._count.bookings > 0) {
    await revokeTrustedDevices(staff.email);
    let voidedCount = 0;
    if (staff.setupPending) {
      // A Pending account (e.g. after an access reset) stays Pending: its
      // links are cancelled so nobody can redeem them, a later Resend invite
      // still works, and Activate stays blocked (ADR-006).
      voidedCount = await prisma.$transaction(async (tx) => {
        const voided =
          (await voidActiveTokens(id, "SETUP", tx)) +
          (await voidActiveTokens(id, "RESET", tx));
        await tx.user.update({
          where: { id },
          data: { isActive: false },
        });
        return voided;
      });
    } else {
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
    }

    // Audit log for deactivation
    await createAuditLog(
      currentUserId,
      AuditAction.STAFF_DEACTIVATED,
      EntityType.STAFF,
      id,
      {
        reason: "Deactivated instead of deleted (has bookings)",
        current: { isActive: false, bookings: staff._count.bookings },
      }
    );

    if (voidedCount > 0) {
      await createAuditLog(
        currentUserId,
        AuditAction.STAFF_TOKENS_VOIDED,
        EntityType.STAFF,
        id,
        {
          reason: `Deactivated instead of deleted; ${voidedCount} unused setup/reset link(s) cancelled`,
        }
      );
    }

    return {
      deleted: false,
      deactivated: true,
      message: "Staff deactivated (has bookings)",
    };
  }

  try {
    await prisma.user.delete({
      where: { id },
    });
  } catch (error) {
    // Booking.createdById is ON DELETE RESTRICT: a booking created after the count
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      throw new ConflictError("This staff member now has bookings. Try again.");
    }
    throw error;
  }

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
